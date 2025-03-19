import * as _ from 'lodash';
import { observable, runInAction } from 'mobx';

import {
    Headers,
    MessageBody,
    InputMessage,
    RawHeaders
} from "../../types";
import {
    fakeBuffer,
    FakeBuffer,
    stringToBuffer,
} from '../../util/buffer';
import { lazyObservablePromise, ObservablePromise, observablePromise } from "../../util/observable";
import {
    asHeaderArray,
    getHeaderValues
} from '../../util/headers';

import { logError } from '../../errors';
import { decodeBody } from '../../services/ui-worker-api';


export class HttpBody implements MessageBody {

    constructor(
        message: InputMessage | { body: Buffer },
        headers: Headers | RawHeaders
    ) {
        if (!('body' in message) || !message.body) {
            this._encoded = stringToBuffer("");
        } else if (Buffer.isBuffer(message.body)) {
            this._encoded = message.body;
        } else if ('buffer' in message.body) {
            this._encoded = message.body.buffer;
        } else {
            this._encoded = fakeBuffer(message.body.encodedLength);
            this._decoded = message.body.decoded;
        }

        this._contentEncoding = asHeaderArray(getHeaderValues(headers, 'content-encoding'));
    }

    private _contentEncoding: string[];
    private _encoded: FakeBuffer | Buffer;
    get encoded() {
        return this._encoded;
    }

    private _decoded: Buffer | undefined;

    @observable
    decodingError: Error | undefined;

    decodedPromise: ObservablePromise<Buffer | undefined> = lazyObservablePromise(async () => {
        // Exactly one of _encoded & _decoded is a buffer, never neither/both.
        if (this._decoded) return this._decoded;
        const encodedBuffer = this.encoded as Buffer;

        // Temporarily change to a fake buffer, while the web worker takes the data to decode
        const encodedLength = encodedBuffer.byteLength;
        this._encoded = fakeBuffer(encodedLength);

        try {
            const { decoded, encoded } = await decodeBody(encodedBuffer, this._contentEncoding);
            this._encoded = encoded;
            return decoded;
        } catch (e: any) {
            logError(e);

            // In most cases, we get the encoded data back regardless, so recapture it here:
            if (e.inputBuffer) {
                this._encoded = e.inputBuffer;
            }
            runInAction(() => {
                this.decodingError = e;
            });

            return undefined;
        }
    });

    get decoded() {
        // We exclude 'Error' from the value - errors should always become undefined
        return this.decodedPromise.value as Buffer | undefined;
    }

    // Must only be called when the exchange & body will no longer be used. Ensures that large data is
    // definitively unlinked, since some browser issues can result in exchanges not GCing immediately.
    // Important: for safety, this leaves the body in a *VALID* but reset state - not a totally blank one.
    cleanup() {
        const emptyBuffer = Buffer.from([]);

        // Set to a valid state for an un-decoded but totally empty body.
        this._decoded = undefined;
        this._encoded = emptyBuffer;
        this.decodingError = undefined;
        this.decodedPromise = observablePromise(Promise.resolve(emptyBuffer));
    }
}