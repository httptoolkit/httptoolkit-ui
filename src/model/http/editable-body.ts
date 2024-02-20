import * as _ from 'lodash';
import { computed, observable, action, runInAction, reaction } from 'mobx';

import { RawHeaders } from '../../types';
import { logError } from "../../errors";
import { asHeaderArray, getHeaderValues } from "../../util/headers";
import {
    observablePromise,
    ObservablePromise,
    getObservableDeferred,
    ObservableDeferred
} from '../../util/observable';

import { encodeBody } from "../../services/ui-worker-api";

export class EditableBody {

    @observable.ref
    private _decodedBody: Buffer;

    /**
     * We effectively track three levels of encoded result in these states:
     * - The last successful result: a fully completed result, useful to access
     *   a previous result synchronously even if a new result is pending.
     * - A current maybe-WIP encoding promise: this is always the most recently
     *   started encoding promise, but due to throttling it may not return the
     *   mostly recently provided decoded data. This is always set (it is not
     *   cleared when the encoding completes).
     * - A queued encoding promise. This is set & unset again synchronously if
     *   there is no throttling in place. When there is throttling, this stays
     *   set with the same throttling until the next encoding can be scheduled.
     *   Waiting on this ensures you'll get a representation at least as new as
     *   the decoded value that's currently set.
     */

    @observable.ref
    private _encodedBody: Buffer | undefined;

    @observable.ref
    private _encodingPromise: ObservablePromise<Buffer>;

    @observable.ref
    private _throttledEncodingDeferred: ObservableDeferred<Buffer> | undefined;

    constructor(
        initialDecodedBody: Buffer,
        initialEncodedBody: Buffer | undefined,
        private getHeaders: () => RawHeaders,
        private options: {
            throttleDuration?: number
        } = { }
    ) {
        this._decodedBody = initialDecodedBody;

        if (initialEncodedBody) {
            this._encodedBody = initialEncodedBody;
            this._encodingPromise = observablePromise(Promise.resolve(initialEncodedBody));
        } else {
            this._encodedBody = undefined;
            this._encodingPromise = this.updateEncodedBody();
        }

        reaction(() => this._decodedBody, () => this.updateEncodedBody());
        reaction(() => this.contentEncodings, () => this.updateEncodedBody());
    }

    private updateEncodedBody = action(() => {
        if (this._throttledEncodingDeferred) return this._throttledEncodingDeferred.promise;

        const encodingDeferred = this._throttledEncodingDeferred = getObservableDeferred<Buffer>();
        this._runThrottledEncodingPromise();
        return encodingDeferred.promise;
    });

    // This should only be called by updateEncodedBody
    private _runThrottledEncodingPromise = _.throttle(async () => {
        if (!this._throttledEncodingDeferred) {
            throw new Error("_runThrottledEncodingPromise should not be called without a queued promise target");
        }

        const encodeBodyDeferred = this._throttledEncodingDeferred;

        this._encodingPromise = encodeBodyDeferred.promise;
        this._throttledEncodingDeferred = undefined;

        const encodings = this.contentEncodings;

        const encodedBody = await encodeBody(this._decodedBody, encodings)
            .catch((e) => {
                logError(e, { encodings });
                return this._decodedBody; // If encoding fails, we send raw data instead
            });

        runInAction(() => {
            // Update the encoded body, if we're the latest encoding request
            if (this._encodingPromise === encodeBodyDeferred.promise) {
                this._encodedBody = encodedBody;
            }
        });

        encodeBodyDeferred.resolve(encodedBody);
    }, this.options.throttleDuration ?? 500, { leading: true, trailing: true });

    @action
    updateDecodedBody(newBody: Buffer) {
        this._decodedBody = newBody;
    }

    @computed.struct
    private get contentEncodings() {
        return asHeaderArray(getHeaderValues(this.getHeaders(), 'content-encoding'));
    }

    /**
     * A synchronous value, providing the length of the latest encoded body value. This is initially
     * undefined, and then always set after the first successful encoding, but may be outdated
     * compared to the real decoded data.
     */
    @computed
    get latestEncodedLength() {
        return this._encodedBody?.byteLength;
    }

    /**
     * Always a promise (although it may already be resolved) representing the encoded result of
     * the current decoded body. Waiting on this will always return a value (in error cases,
     * the decoded value is returned directly, but encodingError is set).
     */
    get encoded() {
        return this._throttledEncodingDeferred?.promise ?? this._encodingPromise;
    }

    get decoded() {
        return this._decodedBody;
    }

}