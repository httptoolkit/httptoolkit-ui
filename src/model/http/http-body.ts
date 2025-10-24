import * as _ from 'lodash';
import { observable, runInAction } from 'mobx';

import {
    Headers,
    MessageBody,
    InputMessage,
    RawHeaders,
    PendingMessageBody,
    DecodedMessageBody,
    FailedDecodeMessageBody
} from "../../types";
import {
    fakeBuffer,
    FakeBuffer,
    stringToBuffer,
} from '../../util/buffer';
import {
    asHeaderArray,
    getHeaderValues
} from './headers';

import { logError } from '../../errors';
import { decodeBody } from '../../services/ui-worker-api';
import { decodingRequired } from '../events/bodies';

export class HttpBody implements MessageBody {

    constructor(
        message: InputMessage | { body: Buffer },
        headers: Headers | RawHeaders
    ) {
        this._contentEncoding = asHeaderArray(getHeaderValues(headers, 'content-encoding'));

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
    }

    private readonly _contentEncoding: string[];

    private _encoded: FakeBuffer | Buffer; // Not readonly - replaced with FakeBuffer on decode
    get encodedData() {
        // We only allow accessing this after a failed decoding (enforced type-level by the
        // MessageBody interfaces), and the data isn't necessarily _always_ available regardless.
        if (this._decodingError && Buffer.isBuffer(this._encoded)) {
            return this._encoded;
        }
    }

    get encodedByteLength() {
        return this._encoded.byteLength;
    }

    private startDecodingAsync() {
        if (!this._decodedPromise) {
            this.waitForDecoding().catch(() => {});
        }
    }

    @observable.ref
    private _decoded: Buffer | undefined;
    get decodedData() {
        // Any attempt to read pending decoded data will trigger the decoding process,
        // if it hasn't already started.
        if (!this._decoded) this.startDecodingAsync();
        return this._decoded;
    }

    isPending(): this is PendingMessageBody {
        return !this._decoded && !this._decodingError;
    }

    isDecoded(): this is DecodedMessageBody {
        // Any attempt to check whether decoded data is available yet will trigger the decoding
        // process, if it hasn't already started.
        if (!this._decoded) this.startDecodingAsync();
        return !!this._decoded;
    }

    isFailed(): this is FailedDecodeMessageBody {
        return !!this._decodingError;
    }

    // Note that exactly one of _encoded & _decoded is a buffer, never neither/both. We set the
    // available buffer in the constructor. After successful encoding, we clear the encoded data
    // and replace it with a fake buffer that just stores the original length. Adding some edge
    // cases, possible states are:
    // * Usual initial state: _encoded set, nothing else
    // * Encoding: _encoded is fake, _decodedPromise is pending, nothing else
    // * Encoded: _encoded is fake, _decoded is set, nothing else
    // * Failed: _encoded is buffer, _decodingError is set, nothing else
    // * Very hard unusual failure: _encoded is fake, _decodingError is set



    // While errors are never thrown, they're stored here, so we can show them in the UI where
    // appropriate (body section, explaining the failure alongside the encoded data for debugging).
    @observable.ref
    private _decodingError: Error | undefined;
    get decodingError() { return this._decodingError; }

    // Not populated until it's read, to reduce memory usage in large sessions
    _decodedPromise: Promise<Buffer | undefined> | undefined;
    waitForDecoding(): Promise<Buffer | undefined> {
        if (this._decoded) return Promise.resolve(this._decoded);
        if (this._decodingError) return Promise.resolve(undefined);

        // If we have no result and no error, we need to do the decoding ourselves (or use
        // an existing pending decoding promise, if already set)
        if (!this._decodedPromise) {
            this._decodedPromise = (async (): Promise<Buffer | undefined> => {
                // One is always set - so if _decoded is not set, _encoded must be.
                const encodedBuffer = this._encoded as Buffer;

                // Change to a fake buffer, while the web worker takes the data to decode. If we
                // decoded successfully, we never put this back (to avoid duplicting the data).
                const encodedLength = encodedBuffer.byteLength;
                this._encoded = fakeBuffer(encodedLength);

                try {
                    // We short-circuit (to avoid the render+async+re-render) if we know that
                    // decoding is not actually required here.
                    const { decoded } = decodingRequired(encodedBuffer, this._contentEncoding)
                        ? await decodeBody(encodedBuffer, this._contentEncoding)
                        : { decoded: encodedBuffer };

                    runInAction(() => {
                        this._decoded = decoded;
                    });

                    return decoded;
                } catch (e: any) {
                    logError(e);

                    // In most cases, we get the encoded data back regardless, so recapture it here:
                    if (e.inputBuffer) {
                        this._encoded = e.inputBuffer;
                    }
                    runInAction(() => {
                        this._decodingError = e;
                    });

                    return undefined;
                } finally {
                    // Once the promise is done, we drop it to save memory (sometimes we store
                    // 10s or 100s of thousands of these objects, so extra data isn't cheap).
                    this._decodedPromise = undefined;
                }

            })();
        }
        return this._decodedPromise;
    }

    // Must only be called when the exchange & body will no longer be used. Ensures that large data is
    // definitively unlinked, since some browser issues can result in exchanges not GCing immediately.
    // Important: for safety, this leaves the body in a *VALID* but reset state - not a totally blank one.
    cleanup() {
        // Set to a valid state for an un-decoded but totally empty body.
        this._decoded = EMPTY_BUFFER;
        this._encoded = EMPTY_BUFFER;
        this._decodingError = undefined;
        this._decodedPromise = undefined;;
    }
}

const EMPTY_BUFFER = Buffer.from([]);