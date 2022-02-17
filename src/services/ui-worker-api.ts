import deserializeError from 'deserialize-error';
import { EventEmitter } from 'events';
import type { OpenAPIObject } from 'openapi-directory';
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
    ParseCertResponse
} from './ui-worker';
import Worker from 'worker-loader!./ui-worker';

import { Omit } from '../types';
import { ApiMetadata } from '../model/api/build-openapi';
import { WorkerFormatterKey } from './ui-worker-formatters';

const worker = new Worker();

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
    if (
        encodings.length === 0 || // No encoding
        (encodings.length === 1 && encodings[0] === 'identity') || // No-op only encoding
        encodedBuffer.length === 0 // Empty body (e.g. HEAD, 204, etc)
    ) {
        // Shortcut to skip decoding when we know it's not required:
        return { encoded: encodedBuffer, decoded: encodedBuffer };
    }

    const result = await callApi<DecodeRequest, DecodeResponse>({
        type: 'decode',
        buffer: encodedBuffer.buffer as ArrayBuffer,
        encodings
    }, [encodedBuffer.buffer]);

    return {
        encoded: Buffer.from(result.inputBuffer),
        decoded: Buffer.from(result.decodedBuffer)
    };
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
    spec: OpenAPIObject,
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

export async function formatBufferAsync(buffer: ArrayBuffer, format: WorkerFormatterKey) {
    return (await callApi<FormatRequest, FormatResponse>({
        type: 'format',
        buffer,
        format
    })).formatted;
}