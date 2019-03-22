import deserializeError from 'deserialize-error';
import { EventEmitter } from 'events';
import { OpenAPIObject } from 'openapi-directory';

import {
    BackgroundRequest,
    BackgroundResponse,
    DecodeRequest,
    DecodeResponse,
    BuildApiResponse,
    BuildApiRequest,
    TestEncodingsRequest,
    TestEncodingsResponse
} from './background-worker';
import Worker from 'worker-loader!./background-worker';

import { Omit } from '../types';
import { ApiMetadata } from '../model/openapi/build-api';

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
 * so whilst this is running body.buffer will temporarily appear empty.
 * Before resolving the original encoded buffer will be put back.
 */
export async function decodeBody(body: { buffer: Buffer }, encodings: string[]) {
    if (encodings.length === 0 || (encodings.length === 1 && encodings[0] === 'identity')) {
        return body.buffer;
    }

    const encodedBuffer = body.buffer.buffer;
    const result = await callApi<DecodeRequest, DecodeResponse>({
        type: 'decode',
        buffer: encodedBuffer as ArrayBuffer,
        encodings
    }, [encodedBuffer]);

    // Put the transferred encoded buffer back
    body.buffer = Buffer.from(result.inputBuffer);

    return Buffer.from(result.decodedBuffer);
}

export async function testEncodingsAsync(decodedBuffer: Buffer) {
    return (await callApi<TestEncodingsRequest, TestEncodingsResponse>({
        type: 'test-encodings',
        decodedBuffer: decodedBuffer
    })).encodingSizes;
}

export async function buildApiMetadataAsync(spec: OpenAPIObject): Promise<ApiMetadata> {
    return (await callApi<BuildApiRequest, BuildApiResponse>({
        type: 'build-api',
        spec
    })).api;
}