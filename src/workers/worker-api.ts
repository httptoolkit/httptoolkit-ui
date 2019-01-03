import { DecodeRequest, DecodeResponse } from './background-worker';
import Worker from 'worker-loader!./background-worker';

import deserializeError from 'deserialize-error';
import { EventEmitter } from 'events';

const worker = new Worker();

let messageId = 0;
const emitter = new EventEmitter();

worker.addEventListener('message', (event) => {
    emitter.emit(event.data.id.toString(), event.data);
});

export async function decodeContent(body: Buffer, encoding?: string) {
    if (!encoding || encoding === 'identity') return body;

    const id = messageId++;

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