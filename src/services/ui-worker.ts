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
import { zipSync, strToU8, ZipOptions } from 'fflate';
import { buildRequestBaseName } from '../util/export-filenames';
import {
    ZIP_EXPORT_MANIFEST_VERSION,
    ZipExportManifest,
    ZipExportEntryRecord,
    ZipExportErrorRecord
} from '../model/ui/zip-manifest';
import { resolveFormats } from '../model/ui/zip-export-formats';
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

export interface ZipExportRequest extends Message {
    type: 'zip-export';
    har: HarFormat.Har;
    // Format ids as per getCodeSnippetFormatKey - the worker resolves these
    // itself, silently skipping any ids it no longer recognizes:
    formatIds: string[];
    // Whether to include the full raw data as requests.har in the archive:
    includeHar: boolean;
    toolVersion: string;
}

export interface ZipExportResponse extends Message {
    error?: Error;
    archive: ArrayBuffer;
    snippetSuccessCount: number;
    snippetErrorCount: number;
    // Per-snippet failures (also recorded in the archive's manifest) so the
    // UI thread can report them:
    errors: ZipExportErrorRecord[];
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


async function handleZipExport(request: ZipExportRequest): Promise<ZipExportResponse> {
    const { id, har, formatIds, includeHar, toolVersion } = request;

    const entries = har.log.entries;
    const total = entries.length;

    const formats = resolveFormats(formatIds);

    if (formats.length === 0 && !includeHar) {
        throw new Error('Nothing selected for ZIP export');
    }

    if (total === 0) {
        throw new Error('No HTTP requests available for ZIP export');
    }

    // fflate treats each key as a full path within the archive:
    const zipEntries: Record<string, Uint8Array | [Uint8Array, ZipOptions]> = {};
    const manifestEntries: ZipExportEntryRecord[] = [];
    const manifestErrors: ZipExportErrorRecord[] = [];
    let snippetSuccessCount = 0;

    for (let i = 0; i < total; i++) {
        // Yield to the event loop periodically, so that during very large
        // exports the worker can still serve its other duties (e.g. body
        // decoding) without multi-second stalls:
        if (i % 20 === 0) {
            await new Promise(r => setTimeout(r, 0));
        }

        const entry = entries[i];

        // Same request preprocessing as the single-snippet export:
        const cleanedReq = simplifyHarRequestForSnippetExport(entry.request);

        const status = entry.response?.status ?? null;
        const baseName = buildRequestBaseName({
            index: i,
            total,
            method: cleanedReq.method,
            url: cleanedReq.url,
            status
        });

        // Building the HTTPSnippet is the expensive part (parsing +
        // normalization), so we do it once per request, not per format:
        const snippet = new HTTPSnippet(cleanedReq);

        for (const fmt of formats) {
            // These paths are unique by construction: every base name
            // starts with the entry's unique index (a prefix that name
            // sanitization & truncation never touch), each format gets
            // its own folder, and the root files (requests.har &
            // manifest.json) sit outside the per-format folders:
            const zipPath = `${fmt.folderName}/${baseName}.${fmt.extension}`;

            try {
                const snippetOutput: unknown = snippet.convert(fmt.target, fmt.client);

                // HTTPSnippet types convert() as string, but it returns
                // false for unknown targets/clients (Kong/httpsnippet#298).
                // We trim to match the single-snippet export exactly:
                const snippetText = typeof snippetOutput === 'string'
                    ? snippetOutput.trim()
                    : '';
                if (snippetText.length === 0) {
                    throw new Error(
                        `HTTPSnippet produced no output for ${fmt.target}/${fmt.client}`
                    );
                }

                zipEntries[zipPath] = strToU8(snippetText);
                snippetSuccessCount++;
            } catch (e: any) {
                // Per-snippet failures are non-fatal: they're recorded in
                // the manifest (and reported by the UI thread), and the
                // rest of the export continues.
                manifestErrors.push({
                    file: baseName,
                    formatId: fmt.id,
                    format: fmt.label,
                    entryIndex: i,
                    method: cleanedReq.method,
                    url: cleanedReq.url,
                    status,
                    error: String(e?.message ?? e)
                });
            }
        }

        manifestEntries.push({
            file: baseName,
            method: cleanedReq.method,
            url: cleanedReq.url,
            status
        });
    }

    if (includeHar) {
        // The full unmodified HAR, as compact JSON (pretty-printing roughly
        // doubles size & stringify time). We use some minimal compression here
        // as this is likely the largest content in the zip by a fair way.
        zipEntries['requests.har'] = [strToU8(JSON.stringify(har)), { level: 1 }];
    }

    const manifest: ZipExportManifest = {
        version: ZIP_EXPORT_MANIFEST_VERSION,
        generatedAt: new Date().toISOString(),
        tool: 'httptoolkit-ui',
        toolVersion,
        requestCount: total,
        formats: formats.map(f => ({
            id: f.id,
            target: f.target,
            client: f.client,
            category: f.category,
            label: f.label,
            folderName: f.folderName,
            extension: f.extension
        })),
        entries: manifestEntries,
        errors: manifestErrors
    };
    zipEntries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));

    // STORE mode (no compression) by default: snippets & the manifest are
    // tiny, so we prioritize packing speed over archive size (requests.har
    // opts into light compression above):
    const archiveBytes = zipSync(zipEntries, { level: 0 });

    const archiveBuffer = archiveBytes.buffer.slice(
        archiveBytes.byteOffset,
        archiveBytes.byteOffset + archiveBytes.byteLength
    ) as ArrayBuffer;

    return {
        id,
        archive: archiveBuffer,
        snippetSuccessCount,
        snippetErrorCount: manifestErrors.length,
        errors: manifestErrors
    };
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
                const zipResult = await handleZipExport(event.data);
                ctx.postMessage(zipResult, [zipResult.archive]);
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