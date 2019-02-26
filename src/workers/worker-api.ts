import { DecodeRequest, DecodeResponse, BuildApiResponse, BuildApiRequest } from './background-worker';
import Worker from 'worker-loader!./background-worker';

import deserializeError from 'deserialize-error';
import { EventEmitter } from 'events';
import { OpenAPIObject } from 'openapi-directory';

import { ApiMetadata } from '../model/openapi/openapi-types';

const worker = new Worker();

let messageId = 0;
function getId() {
    return messageId++;
}

const emitter = new EventEmitter();

worker.addEventListener('message', (event) => {
    emitter.emit(event.data.id.toString(), event.data);
});

export async function decodeContent(body: Buffer, encoding?: string) {
    if (!encoding || encoding === 'identity') return body;
    const id = getId();

    return new Promise<Buffer>((resolve, reject) => {
        worker.postMessage(<DecodeRequest> {
            id,
            type: 'decode',
            buffer: body.buffer,
            encoding
        }, [body.buffer]);

        emitter.once(id.toString(), (data: DecodeResponse) => {
            if (data.error) {
                reject(deserializeError(data.error));
            } else {
                resolve(Buffer.from(data.buffer));
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