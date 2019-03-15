// Worker.ts
const ctx: Worker = self as any;

import * as util from 'util';
import * as serializeError from 'serialize-error';
import { handleContentEncoding } from 'mockttp/dist/server/request-utils';
import { OpenAPIObject } from 'openapi3-ts';

import { compress as brotliCompress } from 'wasm-brotli';
import * as zlib from 'zlib';

import { buildApiMetadata, ApiMetadata } from '../model/openapi/build-api';

const gzipCompress = (buffer: Buffer, options: zlib.ZlibOptions = {}) =>
    new Promise<Buffer>((resolve, reject) => {
        zlib.gzip(buffer, options, (error, result) => error ? reject(error) : resolve(result))
    });

const deflate = (buffer: Buffer, options: zlib.ZlibOptions = {}) =>
    new Promise<Buffer>((resolve, reject) => {
        zlib.deflate(buffer, options, (error, result) => error ? reject(error) : resolve(result))
    });

interface Message {
    id: number;
}

export interface DecodeRequest extends Message {
    type: 'decode';
    buffer: ArrayBuffer;
    encoding: string;
}

export interface DecodeResponse extends Message {
    error?: Error;
    inputBuffer: ArrayBuffer; // Send the input back, since we transferred it
    decodedBuffer: ArrayBuffer;
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

export type BackgroundRequest = DecodeRequest | TestEncodingsRequest | BuildApiRequest;
export type BackgroundResponse = DecodeResponse | TestEncodingsResponse | BuildApiResponse;

function decodeContent(request: DecodeRequest): DecodeResponse {
    const { id, buffer, encoding } = request;
    const result = handleContentEncoding(Buffer.from(buffer), encoding);
    return {
        id,
        inputBuffer: buffer,
        decodedBuffer: result.buffer
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

function buildApi(request: BuildApiRequest): BuildApiResponse {
    const { id, spec } = request;
    return { id, api: buildApiMetadata(spec) };
}

ctx.addEventListener('message', async (event: { data: BackgroundRequest }) => {
    try {
        switch (event.data.type) {
            case 'decode':
                const result = decodeContent(event.data);
                ctx.postMessage(result, [
                    result.inputBuffer,
                    result.decodedBuffer
                ]);
                break;

            case 'test-encodings':
                const { data } = event;
                ctx.postMessage(await testEncodings(data));
                break;

            case 'build-api':
                ctx.postMessage(buildApi(event.data));
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