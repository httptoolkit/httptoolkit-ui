// Worker.ts
const ctx: Worker = self as any;

import * as serializeError from 'serialize-error';
import {
    encodeBuffer,
    decodeBuffer,
    brotliCompress,
    gzip,
    deflate,
    zstdCompress,
    SUPPORTED_ENCODING
} from 'http-encoding';
import { OpenAPIObject } from 'openapi-directory';

import { Headers } from '../types';
import { ApiMetadata, ApiSpec } from '../model/api/api-interfaces';
import { buildOpenApiMetadata, buildOpenRpcMetadata } from '../model/api/build-api-metadata';
import { parseCert, ParsedCertificate, validatePKCS12, ValidationResult } from '../model/crypto';
import { WorkerFormatterKey, formatBuffer } from './ui-worker-formatters';

import type * as HarFormat from 'har-format';
import * as HTTPSnippet from '@httptoolkit/httpsnippet';
import { zipSync, strToU8, type Zippable } from 'fflate';
import {
    buildRequestBaseName,
    buildSnippetZipPath
} from '../util/export-filenames';
import {
    ZIP_EXPORT_MANIFEST_VERSION,
    ZipExportManifest,
    ZipExportEntryRecord,
    ZipExportErrorRecord,
    ZipExportFormatTriple
} from '../model/ui/zip-manifest';
import { simplifyHarRequestForSnippetExport } from '../model/ui/snippet-export-sanitization';

interface Message {
    id: number;
}

export interface DecodeRequest extends Message {
    type: 'decode';
    buffer: ArrayBuffer;
    encodings: string[];
}

export interface DecodeResponse extends Message {
    error?: Error;
    inputBuffer: ArrayBuffer; // Send the input back, since we transferred it
    decodedBuffer: ArrayBuffer;
}

export interface EncodeRequest extends Message {
    type: 'encode';
    buffer: ArrayBuffer;
    encodings: SUPPORTED_ENCODING[];
}

export interface EncodeResponse extends Message {
    error?: Error;
    encodedBuffer: ArrayBuffer;
}

export interface TestEncodingsRequest extends Message {
    type: 'test-encodings';
    decodedBuffer: Buffer;
}

export interface TestEncodingsResponse extends Message {
    error?: Error;
    encodingSizes: { [encoding: string]: number };
}

export interface BuildApiRequest extends Message {
    type: 'build-api';
    spec: ApiSpec;
    baseUrlOverrides?: string[];
}

export interface BuildApiResponse extends Message {
    error?: Error;
    api: ApiMetadata
}

export interface ValidatePKCSRequest extends Message {
    type: 'validate-pkcs12';
    buffer: ArrayBuffer;
    passphrase: string | undefined;
}

export interface ValidatePKCSResponse extends Message {
    error?: Error;
    result: ValidationResult;
}

export interface ParseCertRequest extends Message {
    type: 'parse-cert';
    buffer: ArrayBuffer;
}

export interface ParseCertResponse extends Message {
    error?: Error;
    result: ParsedCertificate;
}

export interface FormatRequest extends Message {
    type: 'format';
    buffer: ArrayBuffer;
    format: WorkerFormatterKey;
    headers?: Headers;
}

export interface FormatResponse extends Message {
    error?: Error;
    formatted: string;
}

export type { ZipExportFormatTriple };

// Sent worker -> UI over the ZIP export control channel, separately from
// the normal request-response routing:
export interface ZipExportProgress {
    percent: number;
    stage: 'preparing' | 'generating' | 'finalizing';
    currentRequest?: number;
    totalRequests?: number;
}

export interface ZipExportRequest extends Message {
    type: 'zip-export';
    har: HarFormat.Har;
    formats: ZipExportFormatTriple[];
    toolVersion: string;
    // Receives { type: 'abort' } from the UI, and sends ZipExportProgress back:
    controlPort?: MessagePort;
}

export interface ZipExportResponse extends Message {
    error?: Error;
    archive: ArrayBuffer;
    cancelled: boolean;
    snippetSuccessCount: number;
    snippetErrorCount: number;
}

export type BackgroundRequest =
    | DecodeRequest
    | EncodeRequest
    | TestEncodingsRequest
    | BuildApiRequest
    | ValidatePKCSRequest
    | ParseCertRequest
    | FormatRequest
    | ZipExportRequest;

export type BackgroundResponse =
    | DecodeResponse
    | EncodeResponse
    | TestEncodingsResponse
    | BuildApiResponse
    | ValidatePKCSResponse
    | ParseCertResponse
    | FormatResponse
    | ZipExportResponse;

const bufferToArrayBuffer = (buffer: Buffer): ArrayBuffer =>
    // Have to remember to slice: this can be a view into part of a much larger buffer!
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

async function decodeRequest(request: DecodeRequest): Promise<DecodeResponse> {
    const { id, buffer, encodings } = request;

    const result = await decodeBuffer(buffer, encodings);
    return {
        id,
        inputBuffer: buffer,
        decodedBuffer: bufferToArrayBuffer(result)
    };
}

async function encodeRequest(request: EncodeRequest): Promise<EncodeResponse> {
    const { id, buffer, encodings } = request;

    const result = await encodings.reduce((contentPromise, nextEncoding) => {
        return contentPromise.then((content) =>
            encodeBuffer(content, nextEncoding)
        )
    }, Promise.resolve(Buffer.from(buffer)));

    return {
        id,
        encodedBuffer: bufferToArrayBuffer(result)
    };
}


async function testEncodings(request: TestEncodingsRequest) {
    const { decodedBuffer } = request;

    return {
        id: request.id,
        encodingSizes: {
            'br': (await brotliCompress(decodedBuffer)).length,
            'zstd': (await zstdCompress(decodedBuffer)).length,
            'gzip': (await gzip(decodedBuffer, { level: 9 })).length,
            'deflate': (await deflate(decodedBuffer, { level: 9 })).length
        }
    };
}

async function buildApi(request: BuildApiRequest): Promise<BuildApiResponse> {
    const { id, spec, baseUrlOverrides } = request;
    return {
        id,
        api: 'openapi' in spec
            ? await buildOpenApiMetadata(spec as OpenAPIObject, baseUrlOverrides)
            : await buildOpenRpcMetadata(spec, baseUrlOverrides)
    };
}


function setZipEntry(zip: Zippable, path: string, data: Uint8Array): void {
    const parts = path.split('/').filter(p => !!p);
    let node: any = zip;
    for (let i = 0; i < parts.length - 1; i++) {
        node = node[parts[i]] = node[parts[i]] ?? {};
    }
    node[parts[parts.length - 1]] = data;
}

// Returns a unique path within the archive, appending _2, _3 etc to the
// filename on collision (e.g. two requests with the same sanitized name):
function reserveZipPath(taken: Set<string>, folder: string, base: string, ext: string): string {
    const extPart = ext ? `.${ext}` : '';
    let candidate = `${folder}/${base}${extPart}`;
    for (let n = 2; taken.has(candidate); n++) {
        candidate = `${folder}/${base}_${n}${extPart}`;
    }
    taken.add(candidate);
    return candidate;
}

// Drops header/query entries whose name or value isn't a string. Some
// HTTPSnippet targets (e.g. clj-http) crash hard on null/undefined values:
function filterStringKV<T extends { name?: any; value?: any }>(
    xs: readonly T[] | undefined
): T[] {
    return Array.isArray(xs)
        ? xs.filter(x => typeof x?.name === 'string' && typeof x?.value === 'string')
        : [];
}

// Builds a reduced HAR request for HTTPSnippet targets that crash on richer
// postData shapes: postData is cut down to { mimeType, text }, and header &
// query values are filtered to plain strings:
function buildReducedRequest(source: HarFormat.Request): HarFormat.Request {
    let postData = source.postData;
    if (postData) {
        const safeText = typeof (postData as any).text === 'string'
            ? (postData as any).text
            : '';
        const safeMime = typeof (postData as any).mimeType === 'string' && (postData as any).mimeType
            ? (postData as any).mimeType
            : 'application/octet-stream';
        postData = { mimeType: safeMime, text: safeText } as HarFormat.PostData;
    }
    return {
        method: source.method || 'GET',
        url: source.url || 'about:blank',
        httpVersion: source.httpVersion || 'HTTP/1.1',
        headers: filterStringKV(source.headers),
        queryString: filterStringKV(source.queryString),
        cookies: [],
        headersSize: -1,
        bodySize: typeof source.bodySize === 'number' ? source.bodySize : 0,
        postData
    };
}

// Last-resort fallback: forces the body to text/plain, so targets that
// parse & descend into JSON bodies (and crash on null values there, e.g.
// clj-http with GraphQL `variables: null`) take the plain-string path:
function buildUltraSafeRequest(source: HarFormat.Request): HarFormat.Request {
    const rawText = typeof (source as any)?.postData?.text === 'string'
        ? (source as any).postData.text
        : '';
    return {
        method: typeof source.method === 'string' ? source.method : 'GET',
        url: typeof source.url === 'string' ? source.url : 'about:blank',
        httpVersion: typeof source.httpVersion === 'string' ? source.httpVersion : 'HTTP/1.1',
        headers: filterStringKV(source.headers),
        queryString: filterStringKV(source.queryString),
        cookies: [],
        headersSize: -1,
        bodySize: typeof source.bodySize === 'number' ? source.bodySize : 0,
        ...(rawText
            ? { postData: { mimeType: 'text/plain', text: rawText } as HarFormat.PostData }
            : {}),
    };
}

// Is this error a known null-shape TypeError, where retrying with a reduced
// request has a realistic chance of success?
function isRecoverableSnippetError(e: any): boolean {
    const msg = String(e?.message ?? e ?? '');
    return (
        e instanceof TypeError
        || /Cannot read propert(y|ies) of (null|undefined)/.test(msg)
    );
}

async function handleZipExport(request: ZipExportRequest): Promise<void> {
    const { id, har, formats, toolVersion, controlPort } = request;

    let cancelled = false;
    if (controlPort) {
        controlPort.onmessage = (e: MessageEvent) => {
            if (e.data?.type === 'abort') cancelled = true;
        };
    }

    try {
        const entries = har.log.entries;
        const total = entries.length;
        const formatCount = formats.length;

        if (formatCount === 0) {
            throw new Error('No formats selected for ZIP export');
        }

        if (total === 0) {
            throw new Error('No HTTP requests available for ZIP export');
        }

        const progress = (
            percent: number,
            stage: ZipExportProgress['stage'],
            currentRequest?: number
        ) => {
            controlPort?.postMessage({
                percent,
                stage,
                currentRequest,
                totalRequests: total
            } satisfies ZipExportProgress);
        };

        progress(0, 'preparing');

        const zipRoot: Zippable = {};
        const manifestEntries: ZipExportEntryRecord[] = [];
        const manifestErrors: ZipExportErrorRecord[] = [];
        let snippetSuccessCount = 0;
        let snippetErrorCount = 0;

        // All assigned paths within this archive, so duplicate basenames
        // (e.g. equal after truncation) can't overwrite each other:
        const usedZipPaths: Set<string> = new Set([
            'requests.har',
            'manifest.json'
        ]);

        for (let i = 0; i < total; i++) {
            // Yield to the event loop every few requests, so abort messages
            // on the control port can be received mid-run:
            if (controlPort && (i % 5 === 0)) {
                await new Promise(r => setTimeout(r, 0));
            }
            if (cancelled) break;

            const entry = entries[i];
            const baseReq: HarFormat.Request = entry?.request ?? {
                method: 'GET',
                url: 'about:blank',
                httpVersion: 'HTTP/1.1',
                headers: [],
                queryString: [],
                cookies: [],
                headersSize: -1,
                bodySize: 0
            };

            // Same request preprocessing as the single-snippet export:
            const cleanedReq = simplifyHarRequestForSnippetExport(baseReq);

            const status = entry?.response?.status ?? null;
            const baseName = buildRequestBaseName({
                index: i,
                total,
                method: cleanedReq.method || 'GET',
                url: cleanedReq.url || 'about:blank',
                status
            });

            // Building the HTTPSnippet is the expensive part (parsing +
            // normalization), so we do it once per request, not per format:
            const snippet = new HTTPSnippet(cleanedReq);

            // Fallback snippets for targets that crash on certain postData
            // shapes (see buildReducedRequest/buildUltraSafeRequest above),
            // instantiated only if actually needed:
            let reducedSnippet: HTTPSnippet | null = null;
            let ultraSafeSnippet: HTTPSnippet | null = null;

            for (let f = 0; f < formatCount; f++) {
                if (cancelled) break;
                const fmt = formats[f];

                // buildSnippetZipPath sanitizes folder+file+extension (no
                // path traversal), reserveZipPath then resolves duplicates:
                const templatePath = buildSnippetZipPath(fmt.folderName, baseName, fmt.extension);
                const slashIdx = templatePath.lastIndexOf('/');
                const folderPart = slashIdx >= 0 ? templatePath.slice(0, slashIdx) : '';
                const filePart = slashIdx >= 0 ? templatePath.slice(slashIdx + 1) : templatePath;
                const dotIdx = filePart.lastIndexOf('.');
                const basePart = dotIdx > 0 ? filePart.slice(0, dotIdx) : filePart;
                const extPart = dotIdx > 0 ? filePart.slice(dotIdx + 1) : '';
                const zipPath = reserveZipPath(usedZipPaths, folderPart, basePart, extPart);

                try {
                    let snippetRaw: unknown;
                    try {
                        snippetRaw = snippet.convert(fmt.target as HTTPSnippet.Target, fmt.client);
                    } catch (primaryErr: any) {
                        // Some targets (notably clj-http) throw on body shapes
                        // they don't expect. Retry twice, with progressively
                        // more conservative versions of the request:
                        if (!isRecoverableSnippetError(primaryErr)) throw primaryErr;
                        try {
                            reducedSnippet ??= new HTTPSnippet(buildReducedRequest(cleanedReq));
                            snippetRaw = reducedSnippet.convert(
                                fmt.target as HTTPSnippet.Target,
                                fmt.client
                            );
                        } catch (secondErr: any) {
                            if (!isRecoverableSnippetError(secondErr)) throw secondErr;
                            ultraSafeSnippet ??= new HTTPSnippet(buildUltraSafeRequest(cleanedReq));
                            snippetRaw = ultraSafeSnippet.convert(
                                fmt.target as HTTPSnippet.Target,
                                fmt.client
                            );
                        }
                    }

                    // HTTPSnippet types convert() as string, but it returns
                    // false for unknown targets/clients (Kong/httpsnippet#298):
                    if (typeof snippetRaw !== 'string' || snippetRaw.length === 0) {
                        throw new Error(
                            `HTTPSnippet produced no output for ${fmt.target}/${fmt.client}`
                        );
                    }

                    setZipEntry(zipRoot, zipPath, strToU8(snippetRaw));
                    snippetSuccessCount++;
                } catch (e: any) {
                    // Per-snippet failures are non-fatal: they're recorded in
                    // the manifest, and the rest of the export continues.
                    manifestErrors.push({
                        file: baseName,
                        formatId: fmt.id,
                        format: fmt.label,
                        entryIndex: i,
                        method: cleanedReq.method || 'GET',
                        url: cleanedReq.url || 'about:blank',
                        status,
                        error: String(e?.message ?? e)
                    });
                    snippetErrorCount++;
                }
            }

            manifestEntries.push({
                file: baseName,
                method: cleanedReq.method || 'GET',
                url: cleanedReq.url || 'about:blank',
                status
            });
            progress(Math.round(((i + 1) / total) * 90), 'generating', i + 1);
        }

        if (cancelled) {
            const response: ZipExportResponse = {
                id,
                archive: new ArrayBuffer(0),
                cancelled: true,
                snippetSuccessCount,
                snippetErrorCount
            };
            ctx.postMessage(response);
            return;
        }

        progress(95, 'finalizing');

        // The full unmodified HAR is included in the archive too, as compact
        // JSON (pretty-printing roughly doubles size & stringify time):
        setZipEntry(zipRoot, 'requests.har', strToU8(JSON.stringify(har)));

        const manifest: ZipExportManifest = {
            version: ZIP_EXPORT_MANIFEST_VERSION,
            generatedAt: new Date().toISOString(),
            tool: 'httptoolkit-ui',
            toolVersion,
            requestCount: total,
            formats,
            entries: manifestEntries,
            errors: manifestErrors
        };
        setZipEntry(zipRoot, 'manifest.json', strToU8(JSON.stringify(manifest, null, 2)));

        // STORE mode (no compression): snippets are tiny, so we prioritize
        // packing speed over archive size:
        const archiveBytes = zipSync(zipRoot, { level: 0 });

        const archiveBuffer = archiveBytes.buffer.slice(
            archiveBytes.byteOffset,
            archiveBytes.byteOffset + archiveBytes.byteLength
        ) as ArrayBuffer;

        progress(100, 'finalizing');

        const response: ZipExportResponse = {
            id,
            archive: archiveBuffer,
            cancelled: false,
            snippetSuccessCount,
            snippetErrorCount
        };

        ctx.postMessage(response, [response.archive]);
    } finally {
        controlPort?.close();
    }
}

ctx.addEventListener('message', async (event: { data: BackgroundRequest }) => {
    try {
        switch (event.data.type) {
            case 'decode':
                try {
                    const decodeResult = await decodeRequest(event.data);
                    ctx.postMessage(decodeResult, [
                        decodeResult.inputBuffer,
                        decodeResult.decodedBuffer
                    ]);
                } catch (e: any) {
                    // Can happen for some Brotli decoding errors:
                    if (typeof e === 'string') {
                        e = new Error(e);
                    }

                    // Special case for decoding errors: we send the encoded data back with the error, so the user can debug it:
                    ctx.postMessage({
                        id: event.data.id,
                        error: Object.assign(serializeError(e), {
                            inputBuffer: event.data.buffer
                        })
                    }, [event.data.buffer]);
                    return;
                }
                break;

            case 'encode':
                const encodeResult = await encodeRequest(event.data);
                ctx.postMessage(encodeResult, [encodeResult.encodedBuffer]);
                break;

            case 'test-encodings':
                const { data } = event;
                ctx.postMessage(await testEncodings(data));
                break;

            case 'build-api':
                ctx.postMessage(await buildApi(event.data));
                break;

            case 'validate-pkcs12':
                const result = validatePKCS12(event.data.buffer, event.data.passphrase);
                ctx.postMessage({ id: event.data.id, result });
                break;

            case 'parse-cert':
                ctx.postMessage({ id: event.data.id, result: parseCert(event.data.buffer) });
                break;

            case 'format':
                const formatted = formatBuffer(event.data.buffer, event.data.format, event.data.headers);
                ctx.postMessage({ id: event.data.id, formatted });
                break;

            case 'zip-export':
                await handleZipExport(event.data);
                break;

            default:
                console.error('Unknown worker event', event);
        }
    } catch (e) {
        ctx.postMessage({
            id: event.data.id,
            error: serializeError(e)
        });
    }
});