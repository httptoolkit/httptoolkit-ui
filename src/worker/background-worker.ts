// Worker.ts
const ctx: Worker = self as any;

import * as serializeError from 'serialize-error';
import { handleContentEncoding } from 'mockttp/dist/server/request-utils';

export interface DecodeRequest {
    id: number;
    type: 'decode';
    buffer: ArrayBuffer;
    encoding: string;
}

export interface DecodeResponse {
    id: number;
    error?: Error;
    buffer: ArrayBuffer;
}

ctx.addEventListener("message", (event) => {
    if (event.data.type === 'decode') {
        const { id, buffer, encoding } = <DecodeRequest> event.data;
        try {
            const result = handleContentEncoding(Buffer.from(buffer), encoding);
            ctx.postMessage(<DecodeResponse> {
                id,
                buffer: result.buffer
            }, [result.buffer]);
        } catch (e) {
            ctx.postMessage({ id, error: serializeError(e) });
        }
    } else {
        console.error('Unknown worker event', event);
    }
});