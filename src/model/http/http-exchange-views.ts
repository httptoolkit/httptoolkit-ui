import { HtkRequest, HtkResponse, TimingEvents } from "../../types";

import { ApiExchange, ApiMetadata } from "../api/api-interfaces";
import { ApiStore } from "../api/api-store";
import { ApiDetector } from "./api-detector";

import { StepClassKey } from "../rules/rules";
import { HTKEventBase } from "../events/event-base";

import { HttpExchange, HttpVersion } from "./http-exchange";
import { UpstreamHttpExchange } from "./upstream-exchange";

/**
 * HttpExchanges actually come in two types: downstream (client input to Mockttp)
 * and upstream (Mockttp extra data for what we really forwarded - e.g. after transform).
 * The events actually stored in the event store's list are always downstream
 * exchanges, but in many cases elsewhere either can be provided.
 *
 * Both define the exact same interface, and various higher-layer components
 * may switch which is passed to the final view components depending on user
 * configuration. Any code that just reads exchange data (i.e. which doesn't
 * update it from events, create/import exchanges, handle breakpoints, etc)
 * should generally use the HttpExchangeView readonly interface where possible.
 */
export interface HttpExchangeView extends HTKEventBase {

    get downstream(): HttpExchange;
    /**
     * Upstream is set if forwarded, but otherwise undefined
     */
    get upstream(): UpstreamHttpExchange | undefined;

    get original(): HttpExchangeView;
    get transformed(): HttpExchangeView;

    get request(): HtkRequest;
    get response(): HtkResponse | 'aborted' | undefined;
    get abortMessage(): string | undefined;

    get api(): ApiExchange | undefined;
    get apiSpec(): ApiMetadata | undefined;

    get httpVersion(): HttpVersion;
    get matchedRule(): { id: string, stepTypes: StepClassKey[] } | false | undefined;
    get tags(): string[];
    get timingEvents(): TimingEvents;

    isHttp(): this is HttpExchangeView;
    isCompletedRequest(): this is CompletedRequest;
    isCompletedExchange(): this is CompletedExchange;
    isSuccessfulExchange(): this is SuccessfulExchange;
    hasRequestBody(): this is CompletedRequest;
    hasResponseBody(): this is SuccessfulExchange;

    hideErrors: boolean;

}

export type CompletedRequest = Omit<HttpExchangeView, 'request'> & {
    matchedRule: { id: string, stepType: StepClassKey } | false
};
export type CompletedExchange = Omit<HttpExchangeView, 'response'> & {
    response: HtkResponse | 'aborted'
};
export type SuccessfulExchange = Omit<HttpExchangeView, 'response'> & {
    response: HtkResponse
};

export abstract class HttpExchangeViewBase extends HTKEventBase implements HttpExchangeView {

    constructor(
        public readonly downstream: HttpExchange,
        private readonly apiStore: ApiStore
    ) {
        super();

        // Start loading the relevant Open API specs for this request, if any.
        this._apiDetector = new ApiDetector(this, apiStore);
    }

    get upstream() { return this.downstream.upstream; }
    get original() { return this.downstream.original }
    get transformed() { return this.downstream.transformed }

    abstract get httpVersion(): HttpVersion;
    abstract get request(): HtkRequest;
    abstract get response(): HtkResponse | 'aborted' | undefined;
    abstract get abortMessage(): string | undefined;

    get id() { return this.downstream.id; }
    get matchedRule() { return this.downstream.matchedRule; }
    get tags() { return this.downstream.tags; }
    get timingEvents() { return this.downstream.timingEvents; }

    private _apiDetector: ApiDetector;
    get api() {
        return this._apiDetector.parsedApi;
    }

    get apiSpec() {
        return this._apiDetector.apiMetadata;
    }

    isHttp(): this is HttpExchangeView {
        return true;
    }

    isCompletedRequest(): this is CompletedRequest {
        return this.downstream.isCompletedRequest();
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

    get pinned() { return this.downstream.pinned; }
    set pinned(value: boolean) { this.downstream.pinned = value; }

    get hideErrors() { return this.downstream.hideErrors; }
    set hideErrors(value: boolean) { this.downstream.hideErrors = value; }

}

export class HttpExchangeOriginalView extends HttpExchangeViewBase implements HttpExchangeView {

    constructor(exchange: HttpExchange, apiStore: ApiStore) {
        super(exchange, apiStore);
    }

    get httpVersion() {
        return this.downstream.httpVersion;
    }

    get request() {
        return this.downstream.request;
    }

    get response() {
        return this.upstream?.response
            ?? this.downstream.response;
    }

    get abortMessage() {
        return this.upstream?.abortMessage
            ?? this.downstream.abortMessage;
    }
}

export class HttpExchangeTransformedView extends HttpExchangeViewBase implements HttpExchangeView {

    constructor(exchange: HttpExchange, apiStore: ApiStore) {
        super(exchange, apiStore);
    }

    get httpVersion() {
        return this.upstream?.httpVersion
            ?? this.downstream?.httpVersion;
    }

    get request() {
        return this.upstream?.request
            ?? this.downstream.request;
    }

    get response() {
        return this.downstream.response;
    }

    get abortMessage() {
        return this.downstream.abortMessage;
    }

    get api() {
        return this.upstream?.api;
    }
}