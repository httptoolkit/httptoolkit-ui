import deserializeError from 'deserialize-error';
import { EventEmitter } from 'events';
import type { SUPPORTED_ENCODING } from 'http-encoding';

import type {
    BackgroundRequest,
    BackgroundResponse,
    DecodeRequest,
    DecodeResponse,
    BuildApiResponse,
    BuildApiRequest,
    TestEncodingsRequest,
    TestEncodingsResponse,
    EncodeRequest,
    EncodeResponse,
    ValidatePKCSRequest,
    ValidatePKCSResponse,
    FormatRequest,
    FormatResponse,
    ParseCertRequest,
    ParseCertResponse,
    GenerateZipRequest,
    GenerateZipResponse
} from './ui-worker';

import { Headers, Omit } from '../types';
import type { ApiMetadata, ApiSpec } from '../model/api/api-interfaces';
import type { SnippetFormatDefinition } from '../model/ui/snippet-formats';
import type { ZipMetadata } from '../model/ui/zip-metadata';
import { WorkerFormatterKey } from './ui-worker-formatters';
import { decodingRequired } from '../model/events/bodies';

const worker = new Worker(new URL('./ui-worker', import.meta.url));

let messageId = 0;
function getId() {
    return messageId++;
}

const emitter = new EventEmitter();

worker.addEventListener('message', (event) => {
    emitter.emit(event.data.id.toString(), event.data);
});

function callApi<
    T extends BackgroundRequest,
    R extends BackgroundResponse
>(request: Omit<T, 'id'>, transfer: any[] = []): Promise<R> {
    const id = getId();

    return new Promise<R>((resolve, reject) => {
        worker.postMessage(Object.assign({ id }, request), transfer);

        emitter.once(id.toString(), (data: R) => {
            if (data.error) {
                reject(deserializeError(data.error));
            } else {
                resolve(data);
            }
        });
    });
}

/**
 * Takes a body, asynchronously decodes it and returns the decoded buffer.
 *
 * Note that this requires transferring the _encoded_ body to a web worker,
 * so after this is run the encoded the buffer will become empty, if any
 * decoding is actually required.
 *
 * The method returns an object containing the new decoded buffer and the
 * original encoded data (transferred back) in a new buffer.
 */
export async function decodeBody(encodedBuffer: Buffer, encodings: string[]) {
    if (!decodingRequired(encodedBuffer, encodings)) {
        // Shortcut to skip decoding when we know it's not required:
        return { encoded: encodedBuffer, decoded: encodedBuffer };
    }

    try {
        const result = await callApi<DecodeRequest, DecodeResponse>({
            type: 'decode',
            buffer: encodedBuffer.buffer as ArrayBuffer,
            encodings
        }, [encodedBuffer.buffer]);

        return {
            encoded: Buffer.from(result.inputBuffer),
            decoded: Buffer.from(result.decodedBuffer)
        };
    } catch (e: any) {
        // In general, the worker should return the original encoded buffer to us, so we can
        // show it to the user to help them debug encoding issues:
        if (e.inputBuffer) {
            e.inputBuffer = Buffer.from(e.inputBuffer);
        }
        throw e;
    }
}

export async function encodeBody(decodedBuffer: Buffer, encodings: string[]) {
    if (
        encodings.length === 0 ||
        (encodings.length === 1 && encodings[0] === 'identity')
    ) {
        // Shortcut to skip encoding when we know it's not required
        return decodedBuffer;
    }

    const result = await callApi<EncodeRequest, EncodeResponse>({
        type: 'encode',
        buffer: decodedBuffer.buffer as ArrayBuffer,
        encodings: encodings as SUPPORTED_ENCODING[]
    });

    return Buffer.from(result.encodedBuffer);
}

export async function testEncodingsAsync(decodedBuffer: Buffer) {
    return (await callApi<TestEncodingsRequest, TestEncodingsResponse>({
        type: 'test-encodings',
        decodedBuffer: decodedBuffer
    })).encodingSizes;
}

export async function buildApiMetadataAsync(
    spec: ApiSpec,
    baseUrlOverrides?: string[]
): Promise<ApiMetadata> {
    return (await callApi<BuildApiRequest, BuildApiResponse>({
        type: 'build-api',
        spec,
        baseUrlOverrides
    })).api;
}

export async function validatePKCS(buffer: ArrayBuffer, passphrase: string | undefined) {
    return (await callApi<ValidatePKCSRequest, ValidatePKCSResponse>({
        type: 'validate-pkcs12',
        buffer,
        passphrase
    })).result;
}

export async function parseCert(buffer: ArrayBuffer) {
    return (await callApi<ParseCertRequest, ParseCertResponse>({
        type: 'parse-cert',
        buffer
    })).result;
}

export async function formatBufferAsync(buffer: Buffer, format: WorkerFormatterKey, headers?: Headers) {
    return (await callApi<FormatRequest, FormatResponse>({
        type: 'format',
        buffer: buffer.buffer as ArrayBuffer,
        format,
        headers,
    })).formatted;
}

export interface ZipProgressInfo {
    phase: string;
    completed: number;
    total: number;
    percent: number;
}

export interface ZipResult {
    buffer: ArrayBuffer;
    /** Number of snippet generations that failed (see _errors.json in the archive) */
    snippetErrors: number;
    /** Total number of snippet generations attempted */
    totalSnippets: number;
}

/**
 * Generates a ZIP archive containing code snippets in all formats plus
 * the HAR data and metadata. All CPU-intensive work runs in the Web Worker.
 *
 * @param harEntries  - Plain (non-MobX-proxy) HAR entry objects. Use toJS() before calling.
 * @param formats     - Which snippet formats to include.
 * @param metadata    - The ZipMetadata object for _metadata.json.
 * @param onProgress  - Optional callback invoked with progress updates (~every 5%).
 * @returns ZipResult with the compressed archive buffer and snippet error counts.
 */
export function generateZipInWorker(
    harEntries: any[],
    formats: SnippetFormatDefinition[],
    metadata: ZipMetadata,
    onProgress?: (info: ZipProgressInfo) => void
): Promise<ZipResult> {
    if (harEntries.length === 0) {
        return Promise.reject(new Error('No entries to export'));
    }
    if (formats.length === 0) {
        return Promise.reject(new Error('No formats selected'));
    }

    const id = getId();

    return new Promise<ZipResult>((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
            worker.removeEventListener('message', handler);
            clearTimeout(timeoutId);
        };

        // Safety timeout: if the worker doesn't respond within 5 minutes,
        // clean up the listener to prevent memory leaks.
        const timeoutId = setTimeout(() => {
            if (!settled) {
                settled = true;
                cleanup();
                reject(new Error('ZIP generation timed out after 5 minutes'));
            }
        }, 5 * 60 * 1000);

        const handler = (event: MessageEvent) => {
            const data = event.data;
            if (data.id !== id) return;

            // Progress messages have a 'type' field; final responses don't
            if (data.type === 'generateZipProgress') {
                onProgress?.({
                    phase: data.phase,
                    completed: data.completed,
                    total: data.total,
                    percent: data.percent
                });
                return; // Keep listening for the final result
            }

            // Final result — always remove listener before resolving/rejecting
            if (settled) return;
            settled = true;
            cleanup();

            if (data.error) {
                reject(deserializeError(data.error));
            } else {
                resolve({
                    buffer: data.buffer,
                    snippetErrors: data.snippetErrors || 0,
                    totalSnippets: data.totalSnippets || 0
                });
            }
        };

        worker.addEventListener('message', handler);

        try {
            worker.postMessage(Object.assign({ id }, {
                type: 'generateZip',
                harEntries,
                formats,
                metadata
            } as Omit<GenerateZipRequest, 'id'>));
        } catch (err) {
            // postMessage can throw for unserializable data (MobX proxies, etc.)
            settled = true;
            cleanup();
            reject(err);
        }
    });
}