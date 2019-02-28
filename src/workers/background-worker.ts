// Worker.ts
const ctx: Worker = self as any;

import * as serializeError from 'serialize-error';
import { handleContentEncoding } from 'mockttp/dist/server/request-utils';
import { OpenAPIObject } from 'openapi3-ts';
import { buildApiMetadata, ApiMetadata } from '../model/openapi/build-api';

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
    buffer: ArrayBuffer;
}

export interface BuildApiRequest extends Message {
    type: 'build-api';
    spec: OpenAPIObject
}

export interface BuildApiResponse extends Message {
    error?: Error;
    api: ApiMetadata
}

type Request = DecodeRequest | BuildApiRequest;

function decodeContent(request: DecodeRequest): DecodeResponse {
    const { id, buffer, encoding } = request;
    const result = handleContentEncoding(Buffer.from(buffer), encoding);
    return { id, buffer: result.buffer };
}

function buildApi(request: BuildApiRequest): BuildApiResponse {
    const { id, spec } = request;
    return { id, api: buildApiMetadata(spec) };
}

ctx.addEventListener('message', (event: { data: Request }) => {
    try {
        switch (event.data.type) {
            case 'decode':
                const result = decodeContent(event.data);
                ctx.postMessage(result, [result.buffer]);
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