import * as _ from 'lodash';
import { observable, action, reaction, observe } from "mobx";

import {
    MockttpBreakpointedRequest,
    MockttpBreakpointedResponse,
    MockttpBreakpointRequestResult,
    BreakpointRequestResult,
    BreakpointResponseResult,
    BreakpointBody,
    MockttpBreakpointResponseResult,
} from "../../types";
import { asHeaderArray } from "../../util";
import { getDeferred, Deferred } from "../../util/promise";
import { reportError } from "../../errors";

import { decodeBody } from "../../services/ui-worker-api";
import { EditableBody } from './editable-body';
import { getStatusMessage } from "./http-docs";
import dedent from 'dedent';

function getBody(message: MockttpBreakpointedRequest | MockttpBreakpointedResponse) {
    return decodeBody(
        message.body.buffer,
        asHeaderArray(message.headers['content-encoding'])
    ).catch((e) => {
        reportError(e);
        const error = dedent`
            HTTP TOOLKIT ERROR: Could not decode body, \
            check content-encoding
        `;
        return {
            encoded: Buffer.from(error),
            decoded: Buffer.from(error)
        };
    });
}

export async function getRequestBreakpoint(request: MockttpBreakpointedRequest) {
    const { encoded, decoded } = await getBody(request);

    const headers = observable(request.headers);

    return new RequestBreakpoint(
        {
            method: request.method,
            url: request.url,
            headers: headers,
        },
        decoded,
        encoded
    );
}

export function getDummyResponseBreakpoint() {
    const breakpoint = new Breakpoint<BreakpointResponseResult>(
        {
            statusCode: 200,
            statusMessage: undefined,
            headers: {},
        },
        Buffer.from(''),
        Buffer.from('')
    );

    return breakpoint;
}

export async function getResponseBreakpoint(response: MockttpBreakpointedResponse) {
    const expectedStatusMessage = getStatusMessage(response.statusCode)
    const statusMessage = expectedStatusMessage === response.statusMessage
        ? undefined
        : response.statusMessage;
    const { encoded, decoded } = await getBody(response);

    return new Breakpoint<BreakpointResponseResult>(
        {
            statusCode: response.statusCode,
            statusMessage: statusMessage,
            headers: response.headers
        },
        decoded,
        encoded
    );
}

type BreakpointInProgress = BreakpointRequestResult | BreakpointResponseResult;

type BreakpointMetadata = Omit<BreakpointInProgress, 'body'>;

type BreakpointResumeType<T extends BreakpointInProgress> =
    T extends BreakpointRequestResult
        ? MockttpBreakpointRequestResult
        : MockttpBreakpointResponseResult;


export class Breakpoint<T extends BreakpointInProgress> {

    protected readonly deferred: Deferred<BreakpointResumeType<T>>;

    @observable.shallow
    private resultMetadata: Omit<T, 'body'>;
    private readonly editableBody: EditableBody;

    constructor(
        result: Omit<T, 'body'>,
        decodedBody: Buffer,
        encodedBody: Buffer | undefined
    ) {
        this.deferred = getDeferred();
        this.resultMetadata = result;
        this.editableBody = new EditableBody(
            decodedBody,
            encodedBody,
            () => this.resultMetadata.headers['content-encoding']
        );

        // Update the content-length when necessary, if it was previously correct
        observe(this.editableBody, 'contentLength', ({
            oldValue: previousEncodedLength,
            newValue: newEncodedLength
        }) => {
            const { headers } = this.resultMetadata;
            const previousContentLength = parseInt(headers['content-length'] || '', 10);

            // If the content-length was previously correct, keep it correct:
            if (previousContentLength === previousEncodedLength) {
                this.updateMetadata({
                    headers: {
                        ...headers,
                        'content-length': newEncodedLength.toString()
                    }
                });
            }
        });

        // When content-length is first added, default to the correct value
        let lastContentLength = this.resultMetadata.headers['content-length'];
        reaction(() => this.resultMetadata.headers['content-length'], (newContentLength) => {
            if (lastContentLength === undefined && newContentLength === "") {
                const correctLength = this.editableBody.contentLength.toString()
                this.inProgressResult.headers['content-length'] = correctLength;
            }

            lastContentLength = newContentLength;
        });
    }

    get inProgressResult(): T {
        return Object.assign(
            {
                body: this.editableBody as BreakpointBody
            },
            this.resultMetadata,
        ) as T;
    }

    @action.bound
    updateMetadata(update: Partial<BreakpointMetadata>) {
        this.resultMetadata = {
            ...this.resultMetadata,
            ..._.omit(update, 'body')
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
            // Build the full encoded body before sending
            body: await this.editableBody.encoded
        } as unknown as BreakpointResumeType<T>);
    }

    reject(error: Error) {
        this.deferred.reject(error);
    }
}

class RequestBreakpoint extends Breakpoint<BreakpointRequestResult> {
    respondDirectly(result: MockttpBreakpointResponseResult) {
        this.deferred.resolve({ response: result });
    }
}

type RequestBreakpointType = RequestBreakpoint;

export { RequestBreakpointType as RequestBreakpoint };
export type ResponseBreakpoint = Breakpoint<BreakpointResponseResult>;