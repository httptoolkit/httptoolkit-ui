// Worker.ts
const ctx: Worker = self as any;

import * as serializeError from 'serialize-error';
import { handleContentEncoding } from 'mockttp/dist/util/request-utils';
import { OpenAPIObject } from 'openapi3-ts';

import { compress as brotliCompress } from 'wasm-brotli';
import * as zlib from 'zlib';

import { buildApiMetadata, ApiMetadata } from '../model/api/build-openapi';
import { validatePKCS12, ValidationResult } from '../model/crypto';

const gzipCompress = (buffer: Buffer, options: zlib.ZlibOptions = {}) =>
    new Promise<Buffer>((resolve, reject) => {
        zlib.gzip(buffer, options,
            (error, result) => error ? reject(error) : resolve(result)
        )
    });

const deflate = (buffer: Buffer, options: zlib.ZlibOptions = {}) =>
    new Promise<Buffer>((resolve, reject) => {
        zlib.deflate(buffer, options,
            (error, result) => error ? reject(error) : resolve(result)
        )
    });

const deflateRaw = (buffer: Buffer, options: zlib.ZlibOptions = {}) =>
    new Promise<Buffer>((resolve, reject) => {
        zlib.deflateRaw(buffer, options,
            (error, result) => error ? reject(error) : resolve(result)
        )
    });

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
    encodings: string[];
}

export interface EncodeResponse extends Message {
    error?: Error;
    inputBuffer: ArrayBuffer; // Send the input back, since we transferred it
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
    spec: OpenAPIObject
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

export type BackgroundRequest =
    | DecodeRequest
    | EncodeRequest
    | TestEncodingsRequest
    | BuildApiRequest
    | ValidatePKCSRequest;

export type BackgroundResponse =
    | DecodeResponse
    | EncodeResponse
    | TestEncodingsResponse
    | BuildApiResponse
    | ValidatePKCSResponse;

function decodeRequest(request: DecodeRequest): DecodeResponse {
    const { id, buffer, encodings } = request;

    const result = handleContentEncoding(Buffer.from(buffer), encodings);
    return {
        id,
        inputBuffer: buffer,
        decodedBuffer: result.buffer as ArrayBuffer
    };
}

const encodeContent = async (body: Buffer, encoding: string) => {
    // This mirrors handleContentEncoding in Mockttp
    if (encoding === 'gzip' || encoding === 'x-gzip') {
        return gzipCompress(body);
    } else if (encoding === 'deflate' || encoding === 'x-deflate') {
        // Deflate is ambiguous, and may or may not have a zlib wrapper.
        // This checks the buffer header directly, based on
        // https://stackoverflow.com/a/37528114/68051
        const lowNibble = body[0] & 0xF;
        if (lowNibble === 8) {
            return deflate(body);
        } else {
            return deflateRaw(body);
        }
    } else if (encoding === 'br') {
        return new Buffer(await brotliCompress(body));
    } else if (!encoding || encoding === 'identity') {
        return body;
    } else {
        throw new Error(`Unknown encoding: ${encoding}`);
    }
};

async function encodeRequest(request: EncodeRequest): Promise<EncodeResponse> {
    const { id, buffer, encodings } = request;

    const result = await encodings.reduce((contentPromise, nextEncoding) => {
        return contentPromise.then((content) =>
            encodeContent(content, nextEncoding)
        )
    }, Promise.resolve(Buffer.from(buffer)));

    return {
        id,
        inputBuffer: buffer,
        encodedBuffer: result.buffer
    };
}


async function testEncodings(request: TestEncodingsRequest) {
    const { decodedBuffer } = request;

    return {
        id: request.id,
        encodingSizes: {
            'br': (await brotliCompress(decodedBuffer)).length,
            'gzip': (await gzipCompress(decodedBuffer, { level: 9 })).length,
            'deflate': (await deflate(decodedBuffer, { level: 9 })).length
        }
    };
}

async function buildApi(request: BuildApiRequest): Promise<BuildApiResponse> {
    const { id, spec } = request;
    return { id, api: await buildApiMetadata(spec) };
}

ctx.addEventListener('message', async (event: { data: BackgroundRequest }) => {
    try {
        switch (event.data.type) {
            case 'decode':
                const decodeResult = decodeRequest(event.data);
                ctx.postMessage(decodeResult, [
                    decodeResult.inputBuffer,
                    decodeResult.decodedBuffer
                ]);
                break;

            case 'encode':
                const encodeResult = await encodeRequest(event.data);
                ctx.postMessage(encodeResult, [
                    encodeResult.inputBuffer,
                    encodeResult.encodedBuffer
                ]);
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