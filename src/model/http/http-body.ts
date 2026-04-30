import { observable, runInAction, action, when } from 'mobx';

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
    asHeaderArray,
    getHeaderValues
} from './headers';

import { logError } from '../../errors';
import { decodeBody } from '../../services/ui-worker-api';
import { decodingRequired } from '../events/bodies';

// Marker init shape for the streaming factory below. Distinguishable from InputMessage and
// { body: Buffer } by the unique 'streaming' key, so 'streaming' in message narrows cleanly.
type StreamingBodyInit = { streaming: true };

export class HttpBody implements MessageBody {

    constructor(
        message: InputMessage | { body: Buffer } | StreamingBodyInit,
        headers: Headers | RawHeaders
    ) {
        this._contentEncoding = asHeaderArray(getHeaderValues(headers, 'content-encoding'));

        if ('streaming' in message) {
            // New streaming ingestion path: chunks arrive later via appendChunk.
            this._bodyState = 'streaming';
            this._encodedChunks = [];
            this._encodedByteLength = 0;
            return;
        }

        // Legacy one-shot ingestion: body is fully present at construction.
        this._bodyState = 'completed';

        if (!('body' in message) || !message.body) {
            this._encodedChunks = [];
            this._encodedByteLength = 0;
        } else if (Buffer.isBuffer(message.body)) {
            this._encodedChunks = [message.body];
            this._encodedByteLength = message.body.byteLength;
        } else if ('buffer' in message.body) {
            this._encodedChunks = [message.body.buffer];
            this._encodedByteLength = message.body.buffer.byteLength;
        } else {
            // HAR-imported body: encoded bytes were never available, only their length and the
            // pre-decoded result. Skip the encoded array entirely.
            this._encodedChunks = undefined;
            this._encodedByteLength = message.body.encodedLength;
            this._decoded = message.body.decoded;
        }
    }

    /**
     * Construct a body that will be populated incrementally. Append bytes via appendChunk
     * as chunks arrive, then finalize with markBodyComplete (normal end) or markBodyAborted
     * (stream interrupted).
     */
    static streaming(headers: Headers | RawHeaders): HttpBody {
        return new HttpBody({ streaming: true }, headers);
    }

    private readonly _contentEncoding: string[];

    // Encoded bytes are stored as an array of chunks until decoding is triggered, at which
    // point they're consolidated into a single buffer and (for non-identity encodings) handed
    // off to the worker — leaving _encodedChunks undefined. _encodedByteLength survives that
    // transition so consumers can keep reading the original encoded length.
    private _encodedChunks: Buffer[] | undefined;

    @observable
    private _encodedByteLength: number = 0;

    get encodedByteLength() {
        return this._encodedByteLength;
    }

    // Recovered encoded bytes after a decode failure: the worker returns the original input
    // buffer alongside the error so the UI can show what we tried to decode.
    @observable.ref
    private _encodedRecovered: Buffer | undefined;

    get encodedData(): Buffer | undefined {
        // Only exposed after a failed decode
        if (this._decodingError) {
            return this._encodedRecovered;
        }
        return undefined;
    }

    // 'streaming' — chunks may still arrive (only via the streaming factory).
    // 'completed' — body fully received; decode may run on demand.
    // 'aborted'   — body terminated mid-stream; decode may still run on the partial bytes
    //               (legitimately succeeds for identity encoding, generally fails for truncated
    //               compressed encodings — surfaced via the standard decode-failure path).
    @observable
    private _bodyState: 'streaming' | 'completed' | 'aborted' = 'completed';

    isComplete(): boolean {
        return this._bodyState !== 'streaming';
    }

    isAborted(): boolean {
        return this._bodyState === 'aborted';
    }

    @action
    appendChunk(chunk: Buffer): void {
        if (this._bodyState !== 'streaming') {
            throw new Error(`Cannot append body chunk: body is in '${this._bodyState}' state`);
        }
        this._encodedChunks!.push(chunk);
        this._encodedByteLength += chunk.byteLength;
    }

    @action
    markBodyComplete(): void {
        if (this._bodyState !== 'streaming') {
            throw new Error(`Cannot mark body complete: body is in '${this._bodyState}' state`);
        }
        this._bodyState = 'completed';
    }

    @action
    markBodyAborted(): void {
        if (this._bodyState !== 'streaming') {
            throw new Error(`Cannot mark body aborted: body is in '${this._bodyState}' state`);
        }
        this._bodyState = 'aborted';
    }

    @observable.ref
    private _decoded: Buffer | undefined;

    get decodedData() {
        // Reading the decoded view triggers decoding (which itself defers until the body
        // reaches a terminal state). Returns undefined until the decode promise resolves.
        if (!this._decoded) this.startDecodingAsync();
        return this._decoded;
    }

    isPending(): this is PendingMessageBody {
        return !this._decoded && !this._decodingError;
    }

    isDecoded(): this is DecodedMessageBody {
        if (!this._decoded) this.startDecodingAsync();
        return !!this._decoded;
    }

    isFailed(): this is FailedDecodeMessageBody {
        return !!this._decodingError;
    }

    @observable.ref
    private _decodingError: Error | undefined;
    get decodingError() { return this._decodingError; }

    private startDecodingAsync() {
        if (!this._decodedPromise) {
            this.waitForDecoding().catch(() => {});
        }
    }

    // Held until the promise settles, then dropped to free closure refs (we may have
    // tens of thousands of these in large sessions).
    private _decodedPromise: Promise<Buffer | undefined> | undefined;

    waitForDecoding(): Promise<Buffer | undefined> {
        if (this._decoded) return Promise.resolve(this._decoded);
        if (this._decodingError) return Promise.resolve(undefined);

        if (!this._decodedPromise) {
            this._decodedPromise = this._runDecode();
        }
        return this._decodedPromise;
    }

    private async _runDecode(): Promise<Buffer | undefined> {
        // Defer until the body has stopped streaming. 'aborted' is a valid terminal state for
        // decode purposes — partial gzip will fail loudly via the standard failure path,
        // partial identity content is just shorter than expected.
        if (this._bodyState === 'streaming') {
            await when(() => this._bodyState !== 'streaming');
        }

        const chunks = this._encodedChunks ?? [];
        const encodedBuffer =
            chunks.length === 0 ? EMPTY_BUFFER :
            chunks.length === 1 ? chunks[0] :
            Buffer.concat(chunks);

        // Drop chunk references; the consolidated buffer will be transferred to the worker
        // (or used directly for identity bodies). The byte length is preserved separately.
        runInAction(() => {
            this._encodedChunks = undefined;
        });

        try {
            const { decoded } = decodingRequired(encodedBuffer, this._contentEncoding)
                ? await decodeBody(encodedBuffer, this._contentEncoding)
                : { decoded: encodedBuffer };

            runInAction(() => {
                this._decoded = decoded;
            });

            return decoded;
        } catch (e: any) {
            logError(e);

            runInAction(() => {
                if (e.inputBuffer) {
                    this._encodedRecovered = e.inputBuffer;
                }
                this._decodingError = e;
            });

            return undefined;
        } finally {
            this._decodedPromise = undefined;
        }
    }

    // Must only be called when the exchange & body will no longer be used. Ensures large data
    // is definitively unlinked, since some browser issues can result in exchanges not GCing
    // immediately. Important: leaves the body in a *VALID* but reset state — equivalent to
    // a completed empty decoded body — not a totally blank one.
    cleanup() {
        this._decoded = EMPTY_BUFFER;
        this._encodedChunks = undefined;
        this._encodedByteLength = 0;
        this._encodedRecovered = undefined;
        this._decodingError = undefined;
        this._decodedPromise = undefined;
        this._bodyState = 'completed';
    }
}

const EMPTY_BUFFER = Buffer.from([]);
