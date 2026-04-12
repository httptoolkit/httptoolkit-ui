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
import * as HTTPSnippet from '@httptoolkit/httpsnippet';
import { zip } from 'fflate';

import { Headers } from '../types';
import { ApiMetadata, ApiSpec } from '../model/api/api-interfaces';
import { buildOpenApiMetadata, buildOpenRpcMetadata } from '../model/api/build-api-metadata';
import { parseCert, ParsedCertificate, validatePKCS12, ValidationResult } from '../model/crypto';
import { WorkerFormatterKey, formatBuffer } from './ui-worker-formatters';
import { buildZipFileName } from '../util/export-filenames';
import type { SnippetFormatDefinition } from '../model/ui/snippet-formats';
import type { ZipMetadata } from '../model/ui/zip-metadata';

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

export interface GenerateZipRequest extends Message {
    type: 'generateZip';
    harEntries: any[];
    formats: SnippetFormatDefinition[];
    metadata: ZipMetadata;
}

export interface GenerateZipResponse extends Message {
    error?: Error;
    buffer: ArrayBuffer;
}

export type BackgroundRequest =
    | DecodeRequest
    | EncodeRequest
    | TestEncodingsRequest
    | BuildApiRequest
    | ValidatePKCSRequest
    | ParseCertRequest
    | FormatRequest
    | GenerateZipRequest;

export type BackgroundResponse =
    | DecodeResponse
    | EncodeResponse
    | TestEncodingsResponse
    | BuildApiResponse
    | ValidatePKCSResponse
    | ParseCertResponse
    | FormatResponse
    | GenerateZipResponse;

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

            case 'generateZip': {
                const { id, harEntries, formats, metadata } = event.data as GenerateZipRequest;

                try {
                    if (!harEntries || harEntries.length === 0) {
                        throw new Error('No HAR entries provided for ZIP export');
                    }
                    if (!formats || formats.length === 0) {
                        throw new Error('No snippet formats selected for ZIP export');
                    }

                    const encoder = new TextEncoder();
                    const files: Record<string, Uint8Array> = {};
                    const totalSteps = formats.length * harEntries.length;
                    let completedSteps = 0;
                    let lastReportedPercent = 0;

                    // Track snippet generation errors for transparency
                    const snippetErrors: Array<{
                        format: string;
                        entryIndex: number;
                        method: string;
                        url: string;
                        error: string;
                    }> = [];

                    // 1. Generate snippet files for each format × each entry
                    for (const format of formats) {
                        for (let i = 0; i < harEntries.length; i++) {
                            const entry = harEntries[i];
                            try {
                                // HTTPSnippet expects a HAR *request* object, not a full
                                // HAR entry. Extract and simplify the request, matching
                                // the pattern used by generateCodeSnippet() on the main
                                // thread (see model/ui/export.ts).
                                const harRequest = entry.request;

                                // Sanitize postData: httpsnippet's HAR validator rejects
                                // null values in postData.text (e.g. CDN beacon POSTs).
                                // Also strip empty queryString entries that fail validation.
                                const postData = harRequest.postData
                                    ? {
                                        ...harRequest.postData,
                                        text: harRequest.postData.text ?? ''
                                    }
                                    : harRequest.postData;

                                const snippetInput = {
                                    ...harRequest,
                                    headers: (harRequest.headers || []).filter((h: any) =>
                                        h.name.toLowerCase() !== 'content-length' &&
                                        h.name.toLowerCase() !== 'content-encoding' &&
                                        !h.name.startsWith(':')
                                    ),
                                    queryString: (harRequest.queryString || []).filter(
                                        (q: any) => q.name !== '' || q.value !== ''
                                    ),
                                    cookies: [], // Included in headers already
                                    ...(postData !== undefined ? { postData } : {})
                                };
                                const snippet = new HTTPSnippet(snippetInput);
                                const code = snippet.convert(format.target, format.client);
                                if (code) {
                                    const filename = buildZipFileName(
                                        i + 1,
                                        entry.request?.method ?? 'UNKNOWN',
                                        entry.response?.status ?? null,
                                        format.extension,
                                        entry.request?.url
                                    );
                                    const content = Array.isArray(code) ? code[0] : code;
                                    files[`${format.folderName}/${filename}`] = encoder.encode(
                                        typeof content === 'string' ? content : String(content)
                                    );
                                }
                            } catch (snippetErr) {
                                // Skip this format for this entry but continue
                                console.warn(
                                    `Snippet generation failed for ${format.folderName}, entry ${i}:`,
                                    snippetErr
                                );
                                snippetErrors.push({
                                    format: format.folderName,
                                    entryIndex: i + 1,
                                    method: entry.request?.method ?? 'UNKNOWN',
                                    url: entry.request?.url ?? 'unknown',
                                    error: snippetErr instanceof Error ? snippetErr.message : String(snippetErr)
                                });
                            }

                            // Report progress every 5% (avoids flooding main thread)
                            completedSteps++;
                            if (totalSteps > 0) {
                                const currentPercent = Math.floor((completedSteps / totalSteps) * 100);
                                if (currentPercent >= lastReportedPercent + 5) {
                                    lastReportedPercent = currentPercent;
                                    ctx.postMessage({
                                        id,
                                        type: 'generateZipProgress',
                                        phase: 'snippets',
                                        completed: completedSteps,
                                        total: totalSteps,
                                        percent: currentPercent
                                    });
                                }
                            }
                        }
                    }

                    // 2. Add full traffic capture as HAR
                    // Contains the complete network traffic (requests + responses
                    // with headers, bodies, timings, cookies) for every exchange.
                    // The snippets in the format folders only reproduce the request;
                    // this file is the authoritative record of what actually happened.
                    const harDocument = {
                        log: {
                            version: '1.2',
                            creator: {
                                name: 'HTTP Toolkit',
                                version: metadata.httptoolkitVersion
                            },
                            entries: harEntries
                        }
                    };
                    const harFileName = `HTTPToolkit_${harEntries.length}-requests_full-traffic.har`;
                    files[harFileName] = encoder.encode(
                        JSON.stringify(harDocument, null, 2)
                    );

                    // 3. Add _metadata.json (include error summary if any)
                    const metadataWithErrors = snippetErrors.length > 0
                        ? { ...metadata, snippetErrors: snippetErrors.length, totalSnippets: totalSteps }
                        : metadata;
                    files['_metadata.json'] = encoder.encode(
                        JSON.stringify(metadataWithErrors, null, 2)
                    );

                    // 3b. If any snippets failed, include a detailed error log
                    if (snippetErrors.length > 0) {
                        files['_errors.json'] = encoder.encode(
                            JSON.stringify({
                                summary: `${snippetErrors.length} of ${totalSteps} snippet generations failed`,
                                errors: snippetErrors
                            }, null, 2)
                        );
                    }

                    // 4. Compress with fflate (async callback API)
                    zip(files, { level: 6 }, (err, data) => {
                        if (err) {
                            ctx.postMessage({
                                id,
                                error: serializeError(err)
                            });
                            return;
                        }
                        // Transfer the ArrayBuffer for zero-copy.
                        // Include snippet error count so the UI can warn if needed.
                        ctx.postMessage(
                            {
                                id,
                                buffer: data.buffer,
                                snippetErrors: snippetErrors.length,
                                totalSnippets: totalSteps
                            },
                            [data.buffer]
                        );
                    });
                } catch (err) {
                    ctx.postMessage({
                        id,
                        error: serializeError(err)
                    });
                }
                // Note: response is sent asynchronously from the zip() callback above
                return;
            }

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