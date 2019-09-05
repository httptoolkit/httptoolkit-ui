import { observable, action } from "mobx";

import {
    MockttpBreakpointedRequest,
    MockttpBreakpointedResponse,
    MockttpBreakpointRequestResult,
    BreakpointRequestResult,
    BreakpointResponseResult,
} from "../types";
import { getDeferred, Deferred, asHeaderArray } from "../util";
import { reportError } from "../errors";

import { decodeBody, encodeBody } from "../services/ui-worker-api";
import { getStatusMessage } from "./http-docs";

export async function getRequestBreakpoint(request: MockttpBreakpointedRequest) {
    return new RequestBreakpoint({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: (
            await decodeBody(
                request.body.buffer,
                asHeaderArray(request.headers['content-encoding'])
            ).catch((e) => {
                reportError(e);
                return { decoded: Buffer.from('') };
            })
        ).decoded
    });
}

export function getDummyResponseBreakpoint() {
    return new Breakpoint<BreakpointResponseResult, BreakpointResponseResult>({
        statusCode: 200,
        statusMessage: undefined,
        headers: {},
        body: Buffer.from('')
    });
}

export async function getResponseBreakpoint(response: MockttpBreakpointedResponse) {
    const expectedStatusMessage = getStatusMessage(response.statusCode)
    const statusMessage = expectedStatusMessage === response.statusMessage
        ? undefined
        : response.statusMessage;

    return new Breakpoint<BreakpointResponseResult, BreakpointResponseResult>({
        statusCode: response.statusCode,
        statusMessage: statusMessage,
        headers: response.headers,
        body: (
            await decodeBody(
                response.body.buffer,
                asHeaderArray(response.headers['content-encoding'])
            ).catch((e) => {
                reportError(e);
                return { decoded: Buffer.from('') };
            })
        ).decoded
    });
}

export class Breakpoint<
    R extends MockttpBreakpointRequestResult | BreakpointResponseResult,
    T extends R & (BreakpointRequestResult | BreakpointResponseResult)
> {

    protected readonly deferred: Deferred<R>;

    @observable.ref
    private _inProgressResult: T;

    constructor(result: T) {
        this.deferred = getDeferred<R>();
        this._inProgressResult = result;
    }

    get inProgressResult() {
        return this._inProgressResult;
    }

    @action.bound
    updateResult(result: Partial<T>) {
        this._inProgressResult = Object.assign({},
            this._inProgressResult,
            result
        );
    }

    @action.bound
    updateBody(body: string) {
        const bodyBuffer = Buffer.from(body);
        const { headers: previousHeaders, body: previousBody } = this.inProgressResult;

        let headers = previousHeaders;

        if (parseInt(headers['content-length'] || '', 10) === (previousBody || '').length) {
            // If the content-length was previous correct, keep it correct:
            headers = Object.assign({}, previousHeaders, {
                'content-length': bodyBuffer.length.toString()
            });
        }

        this.updateResult({
            body: bodyBuffer,
            headers: headers
        } as Partial<T>);
    }

    waitForCompletedResult() {
        return this.deferred.promise;
    }

    readonly resume = async () => {
        const { _inProgressResult: inProgressResult } = this;

        let body = inProgressResult.body;

        if (body) {
            // Encode the body according to the content-encoding specified:
            const encodings = asHeaderArray(inProgressResult.headers['content-encoding']);
            body = (
                await encodeBody(body, encodings).catch((e) => {
                    reportError(e, { encodings });
                    return {
                        encoded: Buffer.from('HTTP TOOLKIT ERROR: COULD NOT ENCODE BODY')
                    };
                })
            ).encoded;
        }

        this.deferred.resolve(
            Object.assign({}, inProgressResult, { body })
        );
    }

    reject(error: Error) {
        this.deferred.reject(error);
    }
}

class RequestBreakpoint extends Breakpoint<
    MockttpBreakpointRequestResult,
    BreakpointRequestResult
> {
    respondDirectly(result: BreakpointResponseResult) {
        this.deferred.resolve({ response: result });
    }
}

type RequestBreakpointType = RequestBreakpoint;

export { RequestBreakpointType as RequestBreakpoint };
export type ResponseBreakpoint = Breakpoint<
    BreakpointResponseResult,
    BreakpointResponseResult
>;