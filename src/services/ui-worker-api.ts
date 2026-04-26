import deserializeError from 'deserialize-error';
import { EventEmitter } from 'events';
import type { Har } from 'har-format';
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
    ZipExportRequest,
    ZipExportResponse,
    ZipExportProgressMessage,
    ZipExportFormatTriple,
    ZipExportPrewarmRequest,
    ZipExportPrewarmResponse
} from './ui-worker';

import { Headers, Omit } from '../types';
import type { ApiMetadata, ApiSpec } from '../model/api/api-interfaces';
import { WorkerFormatterKey } from './ui-worker-formatters';
import { decodingRequired } from '../model/events/bodies';

const worker = new Worker(new URL('./ui-worker', import.meta.url));

let messageId = 0;
function getId() {
    return messageId++;
}

const emitter = new EventEmitter();
const progressEmitter = new EventEmitter();

worker.addEventListener('message', (event) => {
    const data = event.data;
    if (data && data.type === 'zip-export-progress') {
        progressEmitter.emit(data.id.toString(), data);
        return;
    }
    emitter.emit(data.id.toString(), data);
});

/**
 * Additional options for long-running requests (ZIP export, potentially
 * others). Intentionally optional — no existing `callApi` call needs to
 * be modified.
 */
export interface CallApiOptions<R> {
    signal?: AbortSignal;
    onProgress?: (msg: ZipExportProgressMessage) => void;
    cancelChannel?: boolean;
    /**
     * Hard timeout in ms. If the worker does not respond within this window,
     * the call is rejected and (if `cancelChannel` is active) an abort is
     * sent to the worker. `undefined` = no timeout.
     */
    timeoutMs?: number;
}

function callApi<
    T extends BackgroundRequest,
    R extends BackgroundResponse
>(
    request: Omit<T, 'id'>,
    transfer: any[] = [],
    options?: CallApiOptions<R>
): Promise<R> {
    const id = getId();

    return new Promise<R>((resolve, reject) => {
        let cancelChannel: MessageChannel | undefined;
        let finalized = false;
        let progressHandler: ((data: ZipExportProgressMessage) => void) | undefined;
        let abortListener: (() => void) | undefined;
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        let responseHandler: ((data: R) => void) | undefined;
        const signal = options?.signal;

        const finalize = () => {
            if (finalized) return;
            finalized = true;
            if (progressHandler) {
                progressEmitter.off(id.toString(), progressHandler);
            }
            if (responseHandler) {
                emitter.off(id.toString(), responseHandler);
            }
            if (abortListener && signal) {
                try { signal.removeEventListener('abort', abortListener); } catch {}
            }
            if (timeoutHandle !== undefined) {
                clearTimeout(timeoutHandle);
                timeoutHandle = undefined;
            }
            try { cancelChannel?.port1.close(); } catch {}
        };

        // Spread request first, then override with generated id to prevent
        // any request.id from accidentally overwriting the correlation id.
        let payload: any = { ...request, id };
        const transferList = transfer.slice();
        if (options?.cancelChannel) {
            cancelChannel = new MessageChannel();
            payload.cancelPort = cancelChannel.port2;
            transferList.push(cancelChannel.port2);
        }

        if (signal) {
            if (signal.aborted) {
                finalize();
                reject(new DOMException('Aborted', 'AbortError'));
                return;
            }
            abortListener = () => {
                try { cancelChannel?.port1.postMessage({ type: 'abort' }); } catch {}
                // Also reject immediately so the main thread is not blocked
                // waiting for the worker if it is stuck before its next yield.
                finalize();
                reject(new DOMException('Aborted', 'AbortError'));
            };
            signal.addEventListener('abort', abortListener, { once: true });
        }

        if (options?.onProgress) {
            progressHandler = (data: ZipExportProgressMessage) => {
                options.onProgress!(data);
            };
            progressEmitter.on(id.toString(), progressHandler);
        }

        if (typeof options?.timeoutMs === 'number' && options.timeoutMs > 0) {
            timeoutHandle = setTimeout(() => {
                // Proactively try to stop the worker; if it cooperates,
                // this will result in a cancelled response and finalize
                // runs normally. If not, reject directly — the worker
                // can be ignored afterwards.
                try { cancelChannel?.port1.postMessage({ type: 'abort' }); } catch {}
                finalize();
                reject(new Error(
                    `Worker call (${(request as any).type}) timed out after ${options.timeoutMs}ms`
                ));
            }, options.timeoutMs);
        }

        // Register the response handler BEFORE postMessage so that an
        // (unlikely) synchronous worker response cannot be missed.
        responseHandler = (data: R) => {
            finalize();
            if (data.error) {
                reject(deserializeError(data.error));
            } else {
                resolve(data);
            }
        };
        emitter.once(id.toString(), responseHandler);

        worker.postMessage(payload, transferList);
    });
}

export async function decodeBody(encodedBuffer: Buffer, encodings: string[]) {
    if (!decodingRequired(encodedBuffer, encodings)) {
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

/**
 * Hard timeout for ZIP exports. Even very large exports (5k requests ×
 * 37 formats ≈ 185k snippets) complete in a few seconds; 5 minutes is
 * a safeguard against a hung worker, not an expected upper bound.
 */
const ZIP_EXPORT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Pre-warms the ZIP export hot path in the worker. Idempotent, very
 * cheap, fire-and-forget in the UI. Drastically reduces perceived
 * latency on the first "Download ZIP" click because HTTPSnippet + fflate
 * are already JIT-compiled by then.
 */
export async function prewarmZipExport(): Promise<void> {
    try {
        await callApi<ZipExportPrewarmRequest, ZipExportPrewarmResponse>({
            type: 'zip-export-prewarm'
        });
    } catch {
        // Ignore prewarm errors — the actual export will surface a
        // real error that we can display to the user.
    }
}

export async function exportAsZip(args: {
    har: Har;
    formats: ZipExportFormatTriple[];
    toolVersion: string;
    signal?: AbortSignal;
    onProgress?: (p: ZipExportProgressMessage) => void;
    snippetBodySizeLimit?: number;
}): Promise<ZipExportResponse> {
    try {
        return await callApi<ZipExportRequest, ZipExportResponse>(
            {
                type: 'zip-export',
                har: args.har,
                formats: args.formats,
                toolVersion: args.toolVersion,
                snippetBodySizeLimit: args.snippetBodySizeLimit
            },
            [],
            {
                signal: args.signal,
                onProgress: args.onProgress,
                cancelChannel: true,
                timeoutMs: ZIP_EXPORT_TIMEOUT_MS
            }
        );
    } catch (error: any) {
        // Keep the ZIP API contract stable: callers expect cancellation to
        // resolve as a cancelled response, not reject. `callApi` may reject
        // immediately on abort to avoid hangs before the worker yields.
        if (error?.name === 'AbortError') {
            return {
                id: -1,
                archive: new ArrayBuffer(0),
                cancelled: true,
                snippetSuccessCount: 0,
                snippetErrorCount: 0
            };
        }

        throw error;
    }
}
