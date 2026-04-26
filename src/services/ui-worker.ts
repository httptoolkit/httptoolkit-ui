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
import type { Har } from 'har-format';
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
    ZipExportFormatEntry
} from '../model/ui/zip-manifest';
import { simplifyHarEntryRequestForSnippetExport } from '../model/ui/snippet-export-sanitization';

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


export interface ZipExportFormatTriple {
    id: string;
    target: string;
    client: string;
    category: string;
    label: string;
    folderName: string;
    extension: string;
}

export interface ZipExportProgressMessage {
    id: number;
    type: 'zip-export-progress';
    percent: number;
    stage: 'preparing' | 'generating' | 'finalizing';
    currentRequest?: number;
    totalRequests?: number;
}

export interface ZipExportRequest extends Message {
    type: 'zip-export';
    har: Har;
    formats: ZipExportFormatTriple[];
    toolVersion: string;
    snippetBodySizeLimit?: number;
    cancelPort?: MessagePort;
}

export interface ZipExportResponse extends Message {
    error?: Error;
    archive: ArrayBuffer;
    cancelled: boolean;
    snippetSuccessCount: number;
    snippetErrorCount: number;
}

/**
 * Pre-warm for the ZIP export: initializes HTTPSnippet, fflate, and the
 * rest of the export hot path before the user clicks "Download ZIP".
 * Makes the actual export noticeably faster because the expensive first-
 * time initialization of HTTPSnippet + DEFLATE tables has already run in
 * the background while the user is still selecting formats.
 * Idempotent — repeated calls are cheap (just a tiny throwaway snippet +
 * zipSync on an empty root).
 */
export interface ZipExportPrewarmRequest extends Message {
    type: 'zip-export-prewarm';
}

export interface ZipExportPrewarmResponse extends Message {
    error?: Error;
    warmed: true;
}

export type BackgroundRequest =
    | DecodeRequest
    | EncodeRequest
    | TestEncodingsRequest
    | BuildApiRequest
    | ValidatePKCSRequest
    | ParseCertRequest
    | FormatRequest
    | ZipExportRequest
    | ZipExportPrewarmRequest;

export type BackgroundResponse =
    | DecodeResponse
    | EncodeResponse
    | TestEncodingsResponse
    | BuildApiResponse
    | ValidatePKCSResponse
    | ParseCertResponse
    | FormatResponse
    | ZipExportResponse
    | ZipExportPrewarmResponse;

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


/**
 * Places `data` at `path` (POSIX-style, `/`-separated) in the `Zippable`
 * tree. Throws on structural collisions to avoid silently overwriting data:
 *
 *   - Folder-vs-File: if a segment on the way to the leaf already exists
 *     as a file (Uint8Array), descending into it would destroy the file.
 *   - File-vs-Folder: if the leaf already exists as an object (because a
 *     deeper path was created under this name), overwriting would lose the
 *     subtree.
 *   - Leaf duplicate: if this exact path is already populated, we would
 *     silently replace an earlier entry.
 *
 * The caller (handleZipExport) proactively resolves duplicate basenames
 * via reserveZipPath() before calling placeInZip(), so the third condition
 * should never fire in practice, but is included as a safety net.
 */
function placeInZip(zip: Zippable, path: string, data: Uint8Array): void {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) {
        throw new Error('ZIP placement: empty path');
    }
    let cur: any = zip;
    for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i];
        const existing = cur[seg];
        if (existing === undefined) {
            cur[seg] = {};
        } else if (existing instanceof Uint8Array) {
            throw new Error(
                `ZIP placement collision: '${seg}' is a file, cannot descend into it (full path: ${path})`
            );
        }
        cur = cur[seg];
    }
    const leaf = parts[parts.length - 1];
    const existingLeaf = cur[leaf];
    if (existingLeaf !== undefined) {
        if (existingLeaf instanceof Uint8Array) {
            throw new Error(`ZIP placement collision: '${path}' already exists as file`);
        }
        throw new Error(`ZIP placement collision: '${path}' already exists as folder`);
    }
    cur[leaf] = data;
}

/**
 * Per-ZIP path reservation. Returns a unique path in the archive by
 * appending _2, _3, ... to the filename (before the extension) on
 * collision. The folder + file + extension separation is preserved.
 *
 * Used in handleZipExport() with a fresh Set per run, so there are no
 * collisions between different exports.
 */
function reserveZipPath(taken: Set<string>, folder: string, base: string, ext: string): string {
    const extPart = ext ? `.${ext}` : '';
    let candidate = `${folder}/${base}${extPart}`;
    if (!taken.has(candidate)) {
        taken.add(candidate);
        return candidate;
    }
    // Duplicate - find the next free suffix.
    for (let n = 2; n < 10000; n++) {
        candidate = `${folder}/${base}_${n}${extPart}`;
        if (!taken.has(candidate)) {
            taken.add(candidate);
            return candidate;
        }
    }
    // Pathological fallback: use a random suffix, better than overwriting.
    candidate = `${folder}/${base}_${Date.now()}${extPart}`;
    taken.add(candidate);
    return candidate;
}

/**
 * Body length in bytes (UTF-8), falls back to string length if
 * TextEncoder is unavailable. Used only for the truncation cap.
 */
function byteLength(s: string): number {
    try {
        return new TextEncoder().encode(s).byteLength;
    } catch {
        return s.length;
    }
}

/**
 * Replaces the body of a HAR request object with a placeholder if the
 * body exceeds `limit` bytes. The placeholder points to the full
 * requests.har file at the ZIP root.
 */
function truncateRequestBody(
    harRequest: HarFormat.Request,
    limit: number
): HarFormat.Request {
    if (!harRequest.postData || typeof harRequest.postData.text !== 'string') {
        return harRequest;
    }
    const len = byteLength(harRequest.postData.text);
    if (len <= limit) return harRequest;

    return {
        ...harRequest,
        postData: {
            ...harRequest.postData,
            text: `!!! REQUEST BODY TRUNCATED (${len} bytes) - SEE requests.har FOR FULL BODY !!!`
        }
    };
}

/**
 * Filters header/query entries whose `name` or `value` is not a string.
 * For example, clj-http calls `value.constructor.name` on every value
 * and crashes hard on `null`/`undefined`.
 */
function filterStringKV<T extends { name?: any; value?: any }>(
    xs: readonly T[] | undefined
): T[] {
    return Array.isArray(xs)
        ? xs.filter(x => typeof x?.name === 'string' && typeof x?.value === 'string')
        : [];
}

/**
 * Builds a "reduced" HAR request for HTTPSnippet targets that crash on
 * richer postData shapes (notably clj-http). The result keeps method/URL/
 * headers/queryString but reduces `postData` to `{ mimeType, text }` and
 * removes anything that some targets expect as an array/object but find null.
 */
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

/**
 * Ultra-conservative fallback: forces the body to `text/plain` so that
 * null-sensitive targets like clj-http do not attempt to parse or
 * recursively descend into the body. Hardens against the specific bug
 * where clj-http crashes on `JSON.parse(text) === null` (e.g. GraphQL
 * `variables: null`, `persistedQuery: null`) in
 * `jsType(null).constructor.name`. Also covers other targets that crash
 * on null values in body/headers/query.
 */
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
        // Force text/plain: targets then take the body-string path and
        // avoid deep-object descents on potential null values.
        // Conditional spread keeps the field absent (rather than
        // `undefined`) when there is no body — fully type-safe.
        ...(rawText
            ? { postData: { mimeType: 'text/plain', text: rawText } as HarFormat.PostData }
            : {}),
    };
}

/**
 * Heuristic: is the error thrown by the HTTPSnippet target a known
 * "null-shape" TypeError class where a retry with a reduced request
 * realistically has a chance of success?
 */
function isRecoverableSnippetError(e: any): boolean {
    const msg = String(e?.message ?? e ?? '');
    // Observed with clj-http (null postData.params / null jsonObj /
    // null values in allHeaders). The heuristic rule also covers
    // similar "reading 'xxx' of null/undefined" cases in other targets.
    return (
        e instanceof TypeError
        || /Cannot read propert(y|ies) of (null|undefined)/.test(msg)
    );
}

async function handleZipExport(request: ZipExportRequest): Promise<void> {
    const { id, har, formats, toolVersion, cancelPort, snippetBodySizeLimit } = request;

    let cancelled = false;
    if (cancelPort) {
        cancelPort.onmessage = (e: MessageEvent) => {
            if (e.data?.type === 'abort') cancelled = true;
        };
        // Port must be started in Worker context
        try { (cancelPort as any).start?.(); } catch {}
    }

    const entries = har.log.entries;
    const total = entries.length;
    const formatCount = formats.length;

    if (formatCount === 0) {
        throw new Error('No formats selected for ZIP export');
    }

    if (total === 0) {
        throw new Error('No HTTP requests available for ZIP export');
    }

    const progress = (percent: number, stage: 'preparing' | 'generating' | 'finalizing', currentRequest?: number) => {
        const msg: ZipExportProgressMessage = {
            id,
            type: 'zip-export-progress',
            percent,
            stage,
            currentRequest,
            totalRequests: total
        };
        ctx.postMessage(msg);
    };

    progress(0, 'preparing');

    // The original HAR goes into the ZIP unchanged (as an archive
    // reference for the truncation placeholder). For snippet generation
    // we work on sanitized copies.
    const zipRoot: Zippable = {};
    const manifestEntries: ZipExportEntryRecord[] = [];
    const manifestErrors: ZipExportErrorRecord[] = [];
    let snippetSuccessCount = 0;
    let snippetErrorCount = 0;
    // Reserves all already-assigned ZIP paths for this run, so that
    // two requests with the same sanitized basename (e.g. after 120-char
    // truncation) cannot overwrite each other. The reserved top-level
    // names must not be accidentally clobbered by snippets.
    const usedZipPaths: Set<string> = new Set([
        'requests.har',
        'manifest.json',
        '_errors.json'
    ]);

    // Yield helper: releases the event loop so that cancelPort.onmessage
    // can fire. Without this yield, the entire generation loop would run
    // synchronously and cancel would be completely ineffective.
    const yieldToEventLoop = (): Promise<void> => new Promise(r => setTimeout(r, 0));

    for (let i = 0; i < total; i++) {
        if (cancelled) break;

        // Yield every 5 requests so that cancel messages can reach the
        // worker. For large exports (5000+ requests), yielding per request
        // would be too expensive (~4ms overhead per setTimeout on some
        // platforms).
        if (cancelPort && (i % 5 === 0)) {
            await yieldToEventLoop();
            if (cancelled) break;
        }

        const entry = entries[i];
        const rawReq = entry?.request;
        const fallbackReq: HarFormat.Request = {
            method: 'GET',
            url: 'about:blank',
            httpVersion: 'HTTP/1.1',
            headers: [],
            queryString: [],
            cookies: [],
            headersSize: -1,
            bodySize: 0
        };
        const baseReq: HarFormat.Request = rawReq ?? fallbackReq;

        // Single source of truth: same filter as single-snippet export.
        const cleanedReq = simplifyHarEntryRequestForSnippetExport(baseReq);
        const finalReq = typeof snippetBodySizeLimit === 'number' && snippetBodySizeLimit > 0
            ? truncateRequestBody(cleanedReq, snippetBodySizeLimit)
            : cleanedReq;

        const status = entry?.response?.status ?? null;
        const baseName = buildRequestBaseName({
            index: i,
            total,
            method: finalReq.method || 'GET',
            url: finalReq.url || 'about:blank',
            status
        });

        const entryRecord: ZipExportEntryRecord = {
            file: baseName,
            method: finalReq.method || 'GET',
            url: finalReq.url || 'about:blank',
            status
        };

        // Perf hotspot #1: build HTTPSnippet once per request - parsing +
        // normalizing is expensive; `convert()` is the cheap part. An
        // earlier implementation re-instantiated per format, inflating
        // runtime linearly with formatCount.
        const snippet = new HTTPSnippet(finalReq);

        // Lazy fallback snippets: some HTTPSnippet targets (e.g.
        // clj-http) crash on certain `postData` shapes with "Cannot read
        // properties of null". We retry in two stages:
        //  1. reducedSnippet: stripped postData (mimeType + text),
        //     filtered header/query without null values.
        //  2. ultraSafeSnippet: forces text/plain on the body so that
        //     targets no longer trigger the JSON descent.
        // Both are only instantiated on demand.
        let reducedSnippet: HTTPSnippet | null = null;
        const getReducedSnippet = (): HTTPSnippet => {
            if (reducedSnippet) return reducedSnippet;
            reducedSnippet = new HTTPSnippet(buildReducedRequest(finalReq));
            return reducedSnippet;
        };
        let ultraSafeSnippet: HTTPSnippet | null = null;
        const getUltraSafeSnippet = (): HTTPSnippet => {
            if (ultraSafeSnippet) return ultraSafeSnippet;
            ultraSafeSnippet = new HTTPSnippet(buildUltraSafeRequest(finalReq));
            return ultraSafeSnippet;
        };

        for (let f = 0; f < formatCount; f++) {
            if (cancelled) break;
            const fmt = formats[f];
            // buildSnippetZipPath sanitizes folder+file+extension individually
            // (no path traversal possible). reserveZipPath adds duplicate
            // resolution over the already-assigned path space.
            const templatePath = buildSnippetZipPath(fmt.folderName, baseName, fmt.extension);
            const slashIdx = templatePath.lastIndexOf('/');
            const folderPart = slashIdx >= 0 ? templatePath.slice(0, slashIdx) : '';
            const filePart = slashIdx >= 0 ? templatePath.slice(slashIdx + 1) : templatePath;
            const dotIdx = filePart.lastIndexOf('.');
            const basePart = dotIdx > 0 ? filePart.slice(0, dotIdx) : filePart;
            const extPart = dotIdx > 0 ? filePart.slice(dotIdx + 1) : '';
            const zipPath = reserveZipPath(usedZipPaths, folderPart, basePart, extPart);
            try {
                // HTTPSnippet types convert() as string, but the JS
                // implementation returns false for unknown targets/clients
                // (cf. Kong/httpsnippet#298). We therefore defensively
                // check for non-string / empty-string results.
                let snippetRaw: unknown;
                try {
                    snippetRaw = snippet.convert(fmt.target as HTTPSnippet.Target, fmt.client);
                } catch (primaryErr: any) {
                    // Known HTTPSnippet bug: some targets (clj-http et al.)
                    // throw `Cannot read properties of null (reading
                    // 'constructor')` when the body shape does not match
                    // their expectations exactly. We retry in two stages:
                    //  Stage 1: reducedSnippet (stripped postData,
                    //           filtered header/query).
                    //  Stage 2: ultraSafeSnippet (forces text/plain) if
                    //           stage 1 still crashes due to nested-null
                    //           in the JSON body (e.g. GraphQL
                    //           `variables: null`).
                    if (!isRecoverableSnippetError(primaryErr)) {
                        throw primaryErr;
                    }
                    try {
                        snippetRaw = getReducedSnippet().convert(
                            fmt.target as HTTPSnippet.Target,
                            fmt.client
                        );
                    } catch (secondErr: any) {
                        if (!isRecoverableSnippetError(secondErr)) {
                            throw secondErr;
                        }
                        snippetRaw = getUltraSafeSnippet().convert(
                            fmt.target as HTTPSnippet.Target,
                            fmt.client
                        );
                    }
                }
                if (typeof snippetRaw !== 'string' || snippetRaw.length === 0) {
                    throw new Error(
                        `HTTPSnippet produced no output for ${fmt.target}/${fmt.client}`
                    );
                }
                placeInZip(zipRoot, zipPath, strToU8(snippetRaw));
                snippetSuccessCount++;
            } catch (e: any) {
                manifestErrors.push({
                    file: baseName,
                    formatId: fmt.id,
                    format: fmt.label,
                    entryIndex: i,
                    method: finalReq.method || 'GET',
                    url: finalReq.url || 'about:blank',
                    status,
                    error: String(e?.message ?? e)
                });
                snippetErrorCount++;
            }
        }

        manifestEntries.push(entryRecord);
        const percent = Math.round(((i + 1) / total) * 90);
        progress(percent, 'generating', i + 1);
    }

    if (cancelled) {
        const response: ZipExportResponse = {
            id,
            archive: new ArrayBuffer(0),
            cancelled: true,
            snippetSuccessCount,
            snippetErrorCount
        };
        ctx.postMessage(response, []);
        return;
    }

    progress(92, 'finalizing');

    // The complete, unmodified HAR (including original bodies) is
    // included in the archive; snippet placeholders point to it on
    // truncation. Compact JSON (no pretty-print) halves bytes and
    // stringify time. Anyone inspecting it has a JSON viewer anyway.
    placeInZip(zipRoot, 'requests.har', strToU8(JSON.stringify(har)));

    progress(94, 'finalizing');

    const formatsEntry: ZipExportFormatEntry[] = formats.map(f => ({
        id: f.id,
        target: f.target,
        client: f.client,
        category: f.category,
        label: f.label,
        folder: f.folderName,
        extension: f.extension
    }));

    const manifest: ZipExportManifest = {
        version: ZIP_EXPORT_MANIFEST_VERSION,
        generatedAt: new Date().toISOString(),
        tool: 'httptoolkit-ui',
        toolVersion,
        requestCount: total,
        formats: formatsEntry,
        entries: manifestEntries,
        errors: manifestErrors,
        harFile: 'requests.har'
    };

    // manifest.json stays pretty-printed: small, but often manually inspected.
    placeInZip(zipRoot, 'manifest.json', strToU8(JSON.stringify(manifest, null, 2)));

    // Errors also written as standalone _errors.json, making post-mortem
    // analysis easier without parsing the full manifest.json.
    if (manifestErrors.length > 0) {
        placeInZip(
            zipRoot,
            '_errors.json',
            strToU8(JSON.stringify({ errors: manifestErrors }, null, 2))
        );
    }

    progress(96, 'finalizing');

    // Perf hotspot #2 (round 2): STORE mode. No DEFLATE at all.
    // Snippet files are tiny and their combined size is well below the
    // point where compression justifies user wait time. Prioritizing
    // speed >> archive size: level 0 packs in milliseconds instead of
    // seconds, the archive is 2-3x larger depending on content but is
    // delivered instantly.
    const archiveBytes = zipSync(zipRoot, { level: 0 });

    progress(98, 'finalizing');

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
}

/**
 * Warms up the ZIP export hot path. Runs a tiny dummy snippet convert
 * and a dummy zipSync so that the real export has all JIT and module
 * init costs already paid.
 */
let prewarmed = false;
function prewarmZipExportPath(): void {
    if (prewarmed) return;
    try {
        const dummyHar: HarFormat.Request = {
            method: 'GET',
            url: 'https://example.invalid/',
            httpVersion: 'HTTP/1.1',
            headers: [],
            queryString: [],
            cookies: [],
            headersSize: -1,
            bodySize: 0
        };
        // Force HTTPSnippet constructor + convert path to load.
        const snippet = new HTTPSnippet(dummyHar);
        snippet.convert('shell' as HTTPSnippet.Target, 'curl');
        // Force fflate DEFLATE tables init via a trivial zipSync call.
        zipSync({ 'prewarm.txt': strToU8('x') }, { level: 0 });
        prewarmed = true;
    } catch {
        // Prewarm errors are never fatal — the actual export will
        // report the error again.
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

            case 'zip-export-prewarm':
                prewarmZipExportPath();
                ctx.postMessage({ id: event.data.id, warmed: true } as ZipExportPrewarmResponse);
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
