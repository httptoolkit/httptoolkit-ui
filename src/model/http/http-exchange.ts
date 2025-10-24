import * as _ from 'lodash';
import { observable, computed, action, runInAction, when, autorun } from 'mobx';

import {
    HttpExchangeView,
    HtkRequest,
    HtkResponse,
    InputRequest,
    InputResponse,
    InputFailedRequest,
    TimingEvents,
    MockttpBreakpointedRequest,
    MockttpBreakpointedResponse,
    InputCompletedRequest,
    MockttpBreakpointResponseResult,
    InputRuleEventDataMap
} from "../../types";
import { getHeaderValue } from './headers';
import { ParsedUrl } from '../../util/url';


import { MANUALLY_SENT_SOURCE, parseSource } from './sources';
import { getContentType } from '../events/content-types';
import { HTKEventBase } from '../events/event-base';

import { StepClassKey, HtkRule, getRulePartKey } from '../rules/rules';

import { ApiStore } from '../api/api-store';
import { ApiDetector } from './api-detector';

import { HttpBody } from './http-body';
import {
    RequestBreakpoint,
    ResponseBreakpoint,
    getRequestBreakpoint,
    getResponseBreakpoint,
    getDummyResponseBreakpoint
} from './exchange-breakpoint';
import { UpstreamHttpExchange } from './upstream-exchange';
import {
    CompletedExchange,
    CompletedRequest,
    HttpExchangeOriginalView,
    HttpExchangeTransformedView,
    SuccessfulExchange
} from './http-exchange-views';
import { ObservableCache } from '../observable-cache';

const HTTP_VERSIONS = [0.9, 1.0, 1.1, 2.0, 3.0] as const;
export type HttpVersion = typeof HTTP_VERSIONS[number];

export function parseHttpVersion(version: string | undefined): HttpVersion {
    if (version === '0.9') return 0.9;
    if (version === '1.0' || version === '1') return 1.0;
    if (version === '1.1') return 1.1;
    if (version === '2.0' || version === '2') return 2.0;
    if (version === '3.0' || version === '3') return 3.0;

    console.log('Unknown HTTP version:', version);
    return 1.1;
}

function tryParseUrl(url: string): ParsedUrl | undefined  {
    try {
        return Object.assign(
            new URL(url),
            { parseable: true } as const
        );
    } catch (e) {
        console.log('Unparseable URL:', url);
        // There are many unparseable URLs, especially when unintentionally intercepting traffic
        // from non-HTTP sources, so we don't report this - we just log locally & return undefined.
        return unparseableUrl;
    }
}

const unparseableUrl = Object.assign(new URL("unknown://unparseable.invalid/"), { parseable: false } as const);

function addRequestMetadata(request: InputRequest): HtkRequest {
    try {
        return Object.assign(request, {
            parsedUrl: request.url
                ? tryParseUrl(request.url)
                : unparseableUrl,
            source: request.tags.includes('httptoolkit:manually-sent-request')
                ? MANUALLY_SENT_SOURCE
                : parseSource(request.headers['user-agent']),
            body: new HttpBody(request, request.headers),
            contentType: getContentType(getHeaderValue(request.headers, 'content-type')) || 'text',
            cache: new ObservableCache()
        }) as HtkRequest;
    } catch (e) {
        console.log(`Failed to build request for ${request.url}`);
        throw e;
    }
}

function addResponseMetadata(response: InputResponse): HtkResponse {
    return Object.assign(response, {
        body: new HttpBody(response, response.headers),
        contentType: getContentType(getHeaderValue(response.headers, 'content-type')) || 'text',
        cache: new ObservableCache()
    }) as HtkResponse;
}


export class HttpExchange extends HTKEventBase implements HttpExchangeView {

    constructor(
        request: InputRequest,
        protected readonly apiStore: ApiStore
    ) {
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
        .concat(..._.map(this.request.trailers, (value, key) => `${key}: ${value}`))
        .concat(this.request.method)
        .join('\n')
        .toLowerCase();

        // Start loading the relevant Open API specs for this request, if any.
        this._apiDetector = new ApiDetector(this, apiStore);
    }

    public readonly id: string;

    public readonly request: HtkRequest;

    public readonly downstream = this;

    @observable
    public upstream: UpstreamHttpExchange | undefined;

    // These are the same as HttpExchangeViewBase, but need to be copied here (because we're not a _view_,
    // we're original, and TS has no proper mixin support).
    @computed
    get original(): HttpExchangeView {
        if (!this.upstream) return this;

        // If the request is original, then upstream data matches original data
        // I.e. only possible transform was after all upstream data
        if (!this.upstream.wasRequestTransformed) {
            return this.upstream;
        } else {
            return new HttpExchangeOriginalView(this.downstream, this.apiStore);
        }
    }

    @computed
    get transformed(): HttpExchangeView {
        if (!this.upstream) return this;

        // If the response is original, then upstream data matches transformed data
        // I.e. all transforms happened before any upstream data
        if (!this.upstream?.wasResponseTransformed) {
            return this.upstream;
        } else {
            return new HttpExchangeTransformedView(this.downstream, this.apiStore);
        }
    }

    @computed
    get wasTransformed() {
        if (!this.upstream) return false;
        return this.upstream.wasTransformed;
    }

    // An autorun, which ensures the transformed & original views are kept observed & updated, for as long
    // as this upstream exchange exists (until cleanup);
    private computedKeepAlive = {
        dispose: autorun(() => { this.original; this.transformed; })
    };

    @observable
    // Undefined initially, defined for completed requests, false for 'not available'
    public matchedRule: { id: string, stepTypes: StepClassKey[] } | false | undefined;

    @observable
    public tags: string[];

    @observable
    public hideErrors = false; // Set to true when errors are ignored for an exchange

    @computed
    get httpVersion() {
        return parseHttpVersion(this.request.httpVersion);
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
        return this.isCompletedRequest() && this.request.body.encodedByteLength > 0;
    }

    hasResponseBody(): this is SuccessfulExchange {
        return this.isSuccessfulExchange() &&
            (this.response as HtkResponse).body.encodedByteLength > 0;
    }

    @observable
    public readonly timingEvents: TimingEvents;

    @observable.ref
    public response: HtkResponse | 'aborted' | undefined;

    @observable
    public abortMessage: string | undefined;

    updateFromCompletedRequest(request: InputCompletedRequest, matchedRule: HtkRule | false) {
        if (request.body instanceof HttpBody) {
            // If this request was used in new HttpExchange, it's mutated in some ways, and this
            // will cause problems. Shouldn't happen, but we check against it here just in case:
            throw new Error("Can't update from already-processed request");
        }

        this.request.body = new HttpBody(request, request.headers);

        this.matchedRule = !matchedRule
                ? false
            : {
                id: matchedRule.id,
                stepTypes: matchedRule.steps.map(getRulePartKey) as StepClassKey[]
            };

        Object.assign(this.timingEvents, request.timingEvents);
        this.tags = _.union(this.tags, request.tags);
    }

    updateFromUpstreamRequestHead(head: InputRuleEventDataMap['passthrough-request-head']) {
        if (!this.upstream) {
            this.upstream = new UpstreamHttpExchange(this, this.apiStore);
        }
        this.upstream.updateWithRequestHead(head);
    }

    updateFromUpstreamRequestBody(body: InputRuleEventDataMap['passthrough-request-body']) {
        if (!this.upstream) {
            this.upstream = new UpstreamHttpExchange(this, this.apiStore);
        }
        this.upstream.updateWithRequestBody(body);
    }

    markAborted(request: InputFailedRequest) {
        this.response = 'aborted';
        this.searchIndex += '\naborted';

        Object.assign(this.timingEvents, request.timingEvents);
        this.tags = _.union(this.tags, request.tags);

        if ('error' in request && request.error?.message) {
            this.abortMessage = request.error.message ?? 'Unknown error';

            // Prefix the code if not already present (often happens e.g. ECONNRESET)
            if (request.error?.code && !this.abortMessage?.includes(request.error.code)) {
                this.abortMessage = `${request.error.code}: ${this.abortMessage}`;
            }
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
            ..._.map(response.headers, (value, key) => `${key}: ${value}`),
            ..._.map(response.trailers, (value, key) => `${key}: ${value}`)
        ].join('\n').toLowerCase();

        this.upstream?.updateAfterDownstreamResponse(this.response);
    }

    updateFromUpstreamResponseHead(head: InputRuleEventDataMap['passthrough-response-head']) {
        if (!this.upstream) {
            this.upstream = new UpstreamHttpExchange(this, this.apiStore);
        }
        this.upstream.updateWithResponseHead(head);
    }

    updateFromUpstreamResponseBody(body: InputRuleEventDataMap['passthrough-response-body']) {
        if (!this.upstream) {
            this.upstream = new UpstreamHttpExchange(this, this.apiStore);
        }
        this.upstream.updateWithResponseBody(body);
    }

    updateFromUpstreamAbort(abort: InputRuleEventDataMap['passthrough-abort']) {
        if (!this.upstream) {
            this.upstream = new UpstreamHttpExchange(this, this.apiStore);
        }
        this.upstream.updateFromUpstreamAbort(abort);
    }

    // Must only be called when the exchange will no longer be used. Ensures that large data is
    // definitively unlinked, since some browser issues can result in exchanges not GCing immediately.
    // Important: for safety, this leaves the exchange in a *VALID* but reset state - not a totally blank one.
    cleanup() {
        this.computedKeepAlive.dispose();
        this.request.cache.clear();
        this.request.body.cleanup();

        if (this.isSuccessfulExchange()) {
            this.response.cache.clear();
            this.response.body.cleanup();
        }

        if (this.upstream) {
            this.upstream.cleanup();
        }
    }

    // API metadata:

    private _apiDetector: ApiDetector;
    get api() {
        return this._apiDetector.parsedApi;
    }

    get apiSpec() {
        return this._apiDetector.apiMetadata;
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