import * as _ from 'lodash';
import { computed, observable, action, runInAction, reaction } from 'mobx';

import { BreakpointBody } from '../../types';
import { reportError } from "../../errors";
import { asHeaderArray } from "../../util";
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
        private getContentEncodingHeader: () => string | string[] | undefined
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
        return asHeaderArray(this.getContentEncodingHeader());
    }

    private updateEncodedBody = _.throttle(() => {
        const encodeBodyPromise = observablePromise((async () => {
            const encodings = this.contentEncodings;

            const encodedBody = await encodeBody(this._decodedBody, encodings)
                .catch((e) => {
                    reportError(e, { encodings });
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
    }, 500, { leading: true, trailing: true });

    @computed
    get contentLength() {
        return this._encodedBody?.byteLength || 0;
    }

    @computed.struct
    get encoded() {
        return this._encodingPromise;
    }

    @computed.struct
    get decoded() {
        return this._decodedBody;
    }

}