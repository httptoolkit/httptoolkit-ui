import { DecodeRequest, DecodeResponse, BuildApiResponse, BuildApiRequest } from './background-worker';
import Worker from 'worker-loader!./background-worker';

import deserializeError from 'deserialize-error';
import { EventEmitter } from 'events';
import { OpenAPIObject } from 'openapi-directory';

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

/**
 * Takes a body, asynchronously decodes it and returns the decoded buffer.
 *
 * Note that this requires transferring the _encoded_ body to a web worker,
 * so whilst this is running body.buffer will temporarily appear empty.
 * Before resolving the original encoded buffer will be put back.
 */
export async function decodeBody(body: { buffer: Buffer }, encoding: string | undefined) {
    if (!encoding || encoding === 'identity') return body.buffer;
    const id = getId();

    const encodedBuffer = body.buffer.buffer;

    return new Promise<Buffer>((resolve, reject) => {
        worker.postMessage(<DecodeRequest> {
            id,
            type: 'decode',
            buffer: encodedBuffer,
            encoding
        }, [encodedBuffer]);

        emitter.once(id.toString(), (data: DecodeResponse) => {
            if (data.error) {
                reject(deserializeError(data.error));
            } else {
                // Put the transferred encoded buffer back
                body.buffer = Buffer.from(data.inputBuffer);

                resolve(Buffer.from(data.decodedBuffer));
            }
        });
    });
}

export function buildApiMetadataAsync(spec: OpenAPIObject): Promise<ApiMetadata> {
    const id = getId();

    return new Promise<ApiMetadata>((resolve, reject) => {
        worker.postMessage(<BuildApiRequest> {
            id,
            type: 'build-api',
            spec
        });

        emitter.once(id.toString(), (data: BuildApiResponse) => {
            if (data.error) {
                reject(deserializeError(data.error));
            } else {
                resolve(data.api);
            }
        });
    });
}