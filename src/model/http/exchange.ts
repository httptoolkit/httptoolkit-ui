import * as _ from 'lodash';
import { observable, computed, action, runInAction, when } from 'mobx';

import {
    HtkRequest,
    HtkResponse,
    Headers,
    MessageBody,
    InputRequest,
    InputResponse,
    InputFailedRequest,
    TimingEvents,
    InputMessage,
    MockttpBreakpointedRequest,
    MockttpBreakpointedResponse,
    InputCompletedRequest,
    MockttpBreakpointResponseResult,
} from "../../types";
import {
    fakeBuffer,
    FakeBuffer,
    stringToBuffer,
} from '../../util/buffer';
import { UnreachableCheck } from '../../util/error';
import { lazyObservablePromise, ObservablePromise, observablePromise } from "../../util/observable";
import {
    asHeaderArray,
    lastHeader
} from '../../util/headers';

import { logError } from '../../errors';

import { MANUALLY_SENT_SOURCE, parseSource } from './sources';
import { getContentType } from '../events/content-types';
import { HTKEventBase } from '../events/event-base';

import { HandlerClassKey, HtkMockRule, getRulePartKey } from '../rules/rules';

import { ApiStore } from '../api/api-store';
import { ApiExchange } from '../api/api-interfaces';
import { OpenApiExchange } from '../api/openapi';
import { parseRpcApiExchange } from '../api/jsonrpc';
import { ApiMetadata } from '../api/api-interfaces';

import { decodeBody } from '../../services/ui-worker-api';
import {
    RequestBreakpoint,
    ResponseBreakpoint,
    getRequestBreakpoint,
    getResponseBreakpoint,
    getDummyResponseBreakpoint
} from './exchange-breakpoint';

function tryParseUrl(request: InputRequest): (URL & { parseable: true }) | undefined  {
    try {
        return Object.assign(
            new URL(request.url, `${request.protocol}://${request.hostname || 'unknown.invalid'}`),
            { parseable: true } as const
        );
    } catch (e) {
        console.log('Unparseable URL:', request.url);
        // There are many unparseable URLs, especially when unintentionally intercepting traffic
        // from non-HTTP sources, so we don't report this - we just log locally & return undefined.
    }
}

function getFallbackUrl(request: InputRequest): URL & { parseable: false } {
    try {
        return Object.assign(
            new URL("/[unparseable]", `${request.protocol}://${request.hostname || 'unknown.invalid'}`),
            { parseable: false } as const
        );
    } catch (e) {
        return Object.assign(
            new URL("http://unparseable.invalid/"),
            { parseable: false } as const
        );
    }
}

function addRequestMetadata(request: InputRequest): HtkRequest {
    try {
        return Object.assign(request, {
            parsedUrl: tryParseUrl(request) || getFallbackUrl(request),
            source: request.tags.includes('httptoolkit:manually-sent-request')
                ? MANUALLY_SENT_SOURCE
                : parseSource(request.headers['user-agent']),
            body: new HttpBody(request, request.headers),
            contentType: getContentType(lastHeader(request.headers['content-type'])) || 'text',
            cache: observable.map(new Map<symbol, unknown>(), { deep: false })
        }) as HtkRequest;
    } catch (e) {
        console.log(`Failed to parse request for ${request.url} (${request.protocol}://${request.hostname})`);
        throw e;
    }
}

function addResponseMetadata(response: InputResponse): HtkResponse {
    return Object.assign(response, {
        body: new HttpBody(response, response.headers),
        contentType: getContentType(
            // There should only ever be one. If we get multiple though, just use the last.
            lastHeader(response.headers['content-type'])
        ) || 'text',
        cache: observable.map(new Map<symbol, unknown>(), { deep: false })
    }) as HtkResponse;
}

export class HttpBody implements MessageBody {

    constructor(
        message: InputMessage,
        headers: Headers
    ) {
        if (!('body' in message) || !message.body) {
            this._encoded = stringToBuffer("");
        } else if ('buffer' in message.body) {
            this._encoded = message.body.buffer;
        } else {
            this._encoded = fakeBuffer(message.body.encodedLength);
            this._decoded = message.body.decoded;
        }

        this._contentEncoding = asHeaderArray(headers['content-encoding']);
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

export type CompletedRequest = Omit<HttpExchange, 'request'> & {
    matchedRule: { id: string, handlerRype: HandlerClassKey } | false
};
export type CompletedExchange = Omit<HttpExchange, 'response'> & {
    response: HtkResponse | 'aborted'
};
export type SuccessfulExchange = Omit<HttpExchange, 'response'> & {
    response: HtkResponse
};

export class HttpExchange extends HTKEventBase {

    constructor(apiStore: ApiStore, request: InputRequest) {
        super();

        this.request = addRequestMetadata(request);

        this.timingEvents = request.timingEvents;
        this.tags = this.request.tags;

        this.id = this.request.id;
        this.searchIndex = [
            this.request.url,
            this.request.parsedUrl.protocol + '//' +
                this.request.parsedUrl.hostname +
                this.request.parsedUrl.pathname +
                this.request.parsedUrl.search
        ]
        .concat(..._.map(this.request.headers, (value, key) => `${key}: ${value}`))
        .concat(this.request.method)
        .join('\n')
        .toLowerCase();

        // Start loading the relevant Open API specs for this request, if any.
        this._apiMetadataPromise = apiStore.getApi(this.request);
    }

    public readonly request: HtkRequest;
    public readonly id: string;

    @observable
    // Undefined initially, defined for completed requests, false for 'not available'
    public matchedRule: { id: string, handlerStepTypes: HandlerClassKey[] } | false | undefined;

    @observable
    public tags: string[];

    @computed
    get httpVersion() {
        return this.request.httpVersion === '2.0' ? 2 : 1;
    }

    isHttp(): this is HttpExchange {
        return true;
    }

    isCompletedRequest(): this is CompletedRequest {
        return this.matchedRule !== undefined;
    }

    isCompletedExchange(): this is CompletedExchange {
        return !!this.response;
    }

    isSuccessfulExchange(): this is SuccessfulExchange {
        return this.isCompletedExchange() && this.response !== 'aborted';
    }

    hasRequestBody(): this is CompletedRequest {
        return this.isCompletedRequest() && this.request.body.encoded.byteLength > 0;
    }

    hasResponseBody(): this is SuccessfulExchange {
        return this.isSuccessfulExchange() &&
            (this.response as HtkResponse).body.encoded.byteLength > 0;
    }

    @observable
    public readonly timingEvents: Partial<TimingEvents>; // May be {} if using an old server (<0.1.7)

    @observable.ref
    public response: HtkResponse | 'aborted' | undefined;

    @observable
    public abortMessage: string | undefined;

    updateFromCompletedRequest(request: InputCompletedRequest, matchedRule: HtkMockRule | false) {
        if (request.body instanceof HttpBody) {
            // If this request was used in new HttpExchange, it's mutated in some ways, and this
            // will cause problems. Shouldn't happen, but we check against it here just in case:
            throw new Error("Can't update from already-processed request");
        }

        this.request.body = new HttpBody(request, request.headers);

        this.matchedRule = !matchedRule
                ? false
            : 'handler' in matchedRule
                ? {
                    id: matchedRule.id,
                    handlerStepTypes: [getRulePartKey(matchedRule.handler)] as HandlerClassKey[]
                }
            // MatchedRule has multiple steps
                : {
                    id: matchedRule.id,
                    handlerStepTypes: matchedRule.steps.map(getRulePartKey) as HandlerClassKey[]
                };

        Object.assign(this.timingEvents, request.timingEvents);
        this.tags = _.union(this.tags, request.tags);
    }

    markAborted(request: InputFailedRequest) {
        this.response = 'aborted';
        this.searchIndex += '\naborted';

        Object.assign(this.timingEvents, request.timingEvents);
        this.tags = _.union(this.tags, request.tags);

        if ('error' in request && request.error?.message) {
            this.abortMessage = request.error.message;
        }

        if (this.requestBreakpoint) {
            this.requestBreakpoint.reject(
                new Error('Request aborted whilst breakpointed at request')
            );
            this._requestBreakpoint = undefined;
        }
        if (this.responseBreakpoint) {
            this.responseBreakpoint.reject(
                new Error('Request aborted whilst breakpointed at response')
            );
            this._responseBreakpoint = undefined;
        }
    }

    setResponse(response: InputResponse) {
        this.response = addResponseMetadata(response);

        Object.assign(this.timingEvents, response.timingEvents);
        this.tags = _.union(this.tags, response.tags);

        this.searchIndex = [
            this.searchIndex,
            response.statusCode.toString(),
            response.statusMessage.toString(),
            ..._.map(response.headers, (value, key) => `${key}: ${value}`)
        ].join('\n').toLowerCase();

        // Wrap the API promise to also add this response data (but lazily)
        const requestApiPromise = this._apiPromise;
        this._apiPromise = lazyObservablePromise(() =>
            requestApiPromise.then((api) => {
                if (api) api.updateWithResponse(this.response!);
                return api;
            })
        );
    }

    // Must only be called when the exchange will no longer be used. Ensures that large data is
    // definitively unlinked, since some browser issues can result in exchanges not GCing immediately.
    // Important: for safety, this leaves the exchange in a *VALID* but reset state - not a totally blank one.
    cleanup() {
        this.cache.clear();

        this.request.cache.clear();
        this.request.body.cleanup();

        if (this.isSuccessfulExchange()) {
            this.response.cache.clear();
            this.response.body.cleanup();
        }
    }

    // API metadata:

    // A convenient reference to the service-wide spec for this API - starts loading immediately
    private _apiMetadataPromise: Promise<ApiMetadata | undefined>;

    // Parsed API info for this specific request, loaded & parsed lazily, only if it's used
    @observable.ref
    private _apiPromise = lazyObservablePromise(async () => {
        const apiMetadata = await this._apiMetadataPromise;

        if (apiMetadata) {
            // We load the spec, but we don't try to parse API requests until we've received
            // the whole thing (because e.g. JSON-RPC requests aren't parseable without the body)
            await when(() => this.isCompletedRequest());

            try {
                if (apiMetadata.type === 'openapi') {
                    return new OpenApiExchange(apiMetadata, this);
                } else if (apiMetadata.type === 'openrpc') {
                    return await parseRpcApiExchange(apiMetadata, this);
                } else {
                    console.log('Unknown API metadata type for host', this.request.parsedUrl.hostname);
                    console.log(apiMetadata);
                    throw new UnreachableCheck(apiMetadata, m => m.type);
                }
            } catch (e) {
                logError(e);
                throw e;
            }
        } else {
            return undefined;
        }
    });

    // Fixed value for the parsed API data - returns the data or undefined, observably.
    get api() {
        if (this._apiPromise.state === 'fulfilled') {
            return this._apiPromise.value as ApiExchange | undefined;
        }
    }

    // Breakpoint data:

    @observable.ref
    private _requestBreakpoint?: RequestBreakpoint;

    get requestBreakpoint() {
        return this._requestBreakpoint;
    }

    @observable.ref
    private _responseBreakpoint?: ResponseBreakpoint;

    get responseBreakpoint() {
        return this._responseBreakpoint;
    }

    @computed
    get isBreakpointed() {
        return this.requestBreakpoint || this.responseBreakpoint;
    }

    async triggerRequestBreakpoint(request: MockttpBreakpointedRequest) {
        const breakpoint = await getRequestBreakpoint(request);
        runInAction(() => { this._requestBreakpoint = breakpoint; });

        const result = await breakpoint.waitForCompletedResult();

        if (this._requestBreakpoint === breakpoint) {
            runInAction(() => { this._requestBreakpoint = undefined; });
        }

        return result;
    }

    async triggerResponseBreakpoint(response: MockttpBreakpointedResponse) {
        const breakpoint = await getResponseBreakpoint(response);
        runInAction(() => { this._responseBreakpoint = breakpoint; });

        const result = await breakpoint.waitForCompletedResult();

        if (this._responseBreakpoint === breakpoint) {
            runInAction(() => { this._responseBreakpoint = undefined; });
        }

        return result;
    }

    @action.bound
    respondToBreakpointedRequest() {
        // Replace the request breakpoint with an empty response breakpoint
        this._responseBreakpoint = getDummyResponseBreakpoint(this.httpVersion);

        const requestBreakpoint = this.requestBreakpoint!;
        this._requestBreakpoint = undefined;

        // When the response resumes, return it as the request result's response
        this._responseBreakpoint.waitForCompletedResult().then(
            action((responseResult: MockttpBreakpointResponseResult) => {
                requestBreakpoint.respondDirectly(responseResult);
                this._responseBreakpoint = undefined;
            })
        );
    }

}