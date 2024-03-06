import * as _ from 'lodash';
import { observable, action, reaction, observe } from "mobx";
import dedent from 'dedent';

import {
    Headers,
    MockttpBreakpointedRequest,
    MockttpBreakpointedResponse,
    MockttpBreakpointRequestResult,
    BreakpointRequestResult,
    BreakpointResponseResult,
    MockttpBreakpointResponseResult,
} from "../../types";
import { logError } from "../../errors";

import { stringToBuffer } from '../../util/buffer';
import { getDeferred, Deferred } from "../../util/promise";
import {
    asHeaderArray,
    withHeaderValue,
    getHeaderValue,
    headersToRawHeaders,
    rawHeadersToHeaders
} from '../../util/headers';

import {
    RAW_BODY_SUPPORTED,
    serverVersion,
    versionSatisfies
} from '../../services/service-versions';
import { decodeBody } from "../../services/ui-worker-api";

import { EditableBody } from './editable-body';
import { getStatusMessage } from "./http-docs";

function getBody(message: MockttpBreakpointedRequest | MockttpBreakpointedResponse) {
    return decodeBody(
        message.body.buffer,
        asHeaderArray(message.headers['content-encoding'])
    ).catch((e) => {
        logError(e);
        const error = dedent`
            HTTP TOOLKIT ERROR: Could not decode body, \
            check content-encoding
        `;
        return {
            encoded: stringToBuffer(error),
            decoded: stringToBuffer(error)
        };
    });
}

const omitPsuedoHeaders = (headers: Headers) =>
    _.omitBy(headers, (_v, key) => key.startsWith(':')) as Headers;

export async function getRequestBreakpoint(request: MockttpBreakpointedRequest) {
    const { encoded, decoded } = await getBody(request);

    const headers = observable(request.headers);

    return new RequestBreakpoint(
        {
            method: request.method,
            url: request.url,
            rawHeaders: request.rawHeaders ?? headersToRawHeaders(request.headers)
        },
        decoded,
        encoded
    );
}

export function getDummyResponseBreakpoint(httpVersion: 1 | 2) {
    const breakpoint = new ResponseBreakpoint(
        {
            statusCode: 200,
            statusMessage: undefined,
            rawHeaders: httpVersion === 2 ? [[':status', '200']] : [],
        },
        stringToBuffer(''),
        stringToBuffer('')
    );

    return breakpoint;
}

export async function getResponseBreakpoint(response: MockttpBreakpointedResponse) {
    const expectedStatusMessage = getStatusMessage(response.statusCode)
    const statusMessage = expectedStatusMessage === response.statusMessage
        ? undefined
        : response.statusMessage;
    const { encoded, decoded } = await getBody(response);

    return new ResponseBreakpoint(
        {
            statusCode: response.statusCode,
            statusMessage: statusMessage,
            rawHeaders: response.rawHeaders ?? headersToRawHeaders(response.headers)
        },
        decoded,
        encoded
    );
}

type BreakpointInProgress = BreakpointRequestResult | BreakpointResponseResult;

type BreakpointMetadata = Omit<BreakpointInProgress, 'body' | 'rawBody'>;

type BreakpointResumeType<T extends BreakpointInProgress> =
    T extends BreakpointRequestResult
        ? MockttpBreakpointRequestResult
        : MockttpBreakpointResponseResult;


export abstract class Breakpoint<T extends BreakpointInProgress> {

    protected readonly deferred: Deferred<BreakpointResumeType<T>>;

    @observable.shallow
    private resultMetadata: Omit<T, 'body' | 'rawBody'>;
    private readonly editableBody: EditableBody;

    constructor(
        result: Omit<T, 'body' | 'rawBody'>,
        decodedBody: Buffer,
        encodedBody: Buffer | undefined
    ) {
        this.deferred = getDeferred();
        this.resultMetadata = result;
        this.editableBody = new EditableBody(
            decodedBody,
            encodedBody,
            () => this.resultMetadata.rawHeaders
        );

        // Update the content-length when necessary, if it was previously correct
        observe(this.editableBody, 'latestEncodedLength', ({
            oldValue: previousEncodedLength,
            newValue: newEncodedLength
        }) => {
            const { rawHeaders } = this.resultMetadata;
            const previousContentLength = parseInt(getHeaderValue(rawHeaders, 'Content-Length') || '', 10);

            // If the content-length was previously correct, keep it correct:
            if (previousContentLength === previousEncodedLength) {
                this.updateMetadata({
                    rawHeaders: withHeaderValue(rawHeaders, {
                        'Content-Length': newEncodedLength?.toString() ?? '0'
                    })
                });
            }
        });

        // When content-length is first added, default to the correct value
        let oldContentLength = getHeaderValue(this.resultMetadata.rawHeaders, 'Content-Length');
        reaction(() => getHeaderValue(this.resultMetadata.rawHeaders, 'Content-Length'), (newContentLength) => {
            if (oldContentLength === undefined && newContentLength === "") {
                const { rawHeaders } = this.resultMetadata;
                this.updateMetadata({
                    rawHeaders: withHeaderValue(rawHeaders, {
                        'Content-Length': this.editableBody.latestEncodedLength?.toString() ?? '0'
                    })
                });
            }

            oldContentLength = newContentLength;
        });
    }

    get inProgressResult(): T {
        return Object.assign(
            {
                body: this.editableBody as EditableBody
            },
            this.resultMetadata,
        ) as T;
    }

    @action.bound
    updateMetadata(update: Partial<BreakpointMetadata>) {
        this.resultMetadata = {
            ...this.resultMetadata,
            ..._.omit(update, 'body', 'rawBody')
        };
    }

    @action.bound
    updateBody(body: Buffer) {
        this.editableBody.updateDecodedBody(body);
    }

    waitForCompletedResult() {
        return this.deferred.promise;
    }

    readonly resume = async () => {
        this.deferred.resolve({
            ...this.resultMetadata,

            ...(versionSatisfies(await serverVersion, RAW_BODY_SUPPORTED)
                // Mockttp v3+ skips auto-encoding only if you use rawBody:
                ? { rawBody: await this.editableBody.encodingBestEffortPromise }
                // Old Mockttp doesn't support rawBody, never auto-encodes:
                : { body: await this.editableBody.encodingBestEffortPromise }
            ),

            // Psuedo-headers those will be generated automatically from the other,
            // fields, as part of the rest of the request process.
            headers: omitPsuedoHeaders(rawHeadersToHeaders(this.resultMetadata.rawHeaders))
        } as unknown as BreakpointResumeType<T>);
    }

    abstract close(): void;

    reject(error: Error) {
        this.deferred.reject(error);
    }
}

class RequestBreakpoint extends Breakpoint<BreakpointRequestResult> {
    respondDirectly(result: MockttpBreakpointResponseResult) {
        this.deferred.resolve({ response: result });
    }

    close = () => {
        this.deferred.resolve({ response: 'close' });
    }
}

class ResponseBreakpoint extends Breakpoint<BreakpointResponseResult> {
    close = () => {
        this.deferred.resolve('close');
    }
}

type RequestBreakpointType = RequestBreakpoint;
type ResponseBreakpointType = ResponseBreakpoint

export {
    RequestBreakpointType as RequestBreakpoint,
    ResponseBreakpointType as ResponseBreakpoint
};