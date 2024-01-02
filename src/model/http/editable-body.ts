import * as _ from 'lodash';
import { computed, observable, action, runInAction, reaction } from 'mobx';

import { BreakpointBody, RawHeaders } from '../../types';
import { logError } from "../../errors";
import { asHeaderArray, getHeaderValues } from "../../util/headers";
import { observablePromise, ObservablePromise } from '../../util/observable';

import { encodeBody } from "../../services/ui-worker-api";

export class EditableBody implements BreakpointBody {

    @observable.ref
    private _decodedBody: Buffer;

    @observable.ref
    private _encodedBody: Buffer | undefined;

    @observable.ref
    private _encodingPromise!: ObservablePromise<Buffer>;

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
            this.updateEncodedBody();
        }

        reaction(() => this._decodedBody, () => this.updateEncodedBody());
        reaction(() => this.contentEncodings, () => this.updateEncodedBody());
    }

    @action
    updateDecodedBody(newBody: Buffer) {
        this._decodedBody = newBody;
    }

    @computed.struct
    private get contentEncodings() {
        return asHeaderArray(getHeaderValues(this.getHeaders(), 'content-encoding'));
    }

    private updateEncodedBody = _.throttle(action(() => {
        const encodeBodyPromise = observablePromise((async () => {
            const encodings = this.contentEncodings;

            const encodedBody = await encodeBody(this._decodedBody, encodings)
                .catch((e) => {
                    logError(e, { encodings });
                    return this._decodedBody; // If encoding fails, we send raw data instead
                });

            runInAction(() => {
                // Update the encoded body, only if we're the latest encoding request
                if (this._encodingPromise === encodeBodyPromise) {
                    this._encodedBody = encodedBody;
                }
            });

            return encodedBody;
        })());

        this._encodingPromise = encodeBodyPromise;
    }), this.options.throttleDuration ?? 500, { leading: true, trailing: true });

    @computed
    get contentLength() {
        return this._encodedBody?.byteLength || 0;
    }

    get encoded() {
        return this._encodingPromise;
    }

    get decoded() {
        return this._decodedBody;
    }

}