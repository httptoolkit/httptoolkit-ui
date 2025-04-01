import * as _ from 'lodash';
import { computed, observable } from 'mobx';

import {
    HtkRequest,
    RawHeaders,
    InputRuleEventDataMap,
    HtkResponse
} from '../../types';

import { getHeaderValue, rawHeadersToHeaders } from '../../util/headers';
import { ParsedUrl } from '../../util/url';
import { asBuffer } from '../../util/buffer';

import { getContentType } from '../events/content-types';
import { HttpBody } from './http-body';
import {
    ViewableHttpExchange,
    HttpExchange,
    parseHttpVersion,
    CompletedRequest,
    SuccessfulExchange,
    CompletedExchange
} from './exchange';
import { parseSource } from './sources';
import { HTKEventBase } from '../events/event-base';

const upstreamRequestToUrl = (request: InputRuleEventDataMap['passthrough-request-head']): ParsedUrl => {
    const portString = request.port ? `:${request.port}` : '';
    return Object.assign(
        new URL(`${request.protocol}://${request.hostname}${portString}${request.path}`),
        { parseable: true }
    );
}

/**
 * Represents an HTTP exchange upstream of HTTP Toolkit, i.e. forwarded to a remote server. This
 * is usually the same data as the downstream exchange (roughly) but can notably differ when the
 * request is transformed before forwarding (by transform rule or by breakpoint).
 *
 * This works because Mockttp exposes a flexible rule-event API for rule-specific events, and
 * passthrough rules specifically fire 4 events if a listener is registered, for the head/body
 * of the request & response. Note that the body data is empty with overridden:false if the
 * passthrough data is the same as the original body data.
 *
 * This class stores only the differences (to avoid duplicating message bodies etc in memory),
 * but exposes the result as a full HtkRequest/HtkResponse pair for easy usage elsewhere.
 */
export class UpstreamHttpExchange extends HTKEventBase implements ViewableHttpExchange {

    constructor(
        public readonly downstream: HttpExchange
    ) {
        super();
    }

    readonly upstream: UpstreamHttpExchange = this;

    @observable
    private upstreamHttpVersion: string | undefined;

    @observable
    private upstreamRequestData: {
        url: ParsedUrl,
        method: string,
        rawHeaders: RawHeaders,
        body?: HttpBody
    } | undefined;

    @observable
    private upstreamResponseData: {
        statusCode: number,
        statusMessage: string | undefined,
        rawHeaders: RawHeaders,
        body?: HttpBody
    } | undefined;

    @computed
    public get wasRequestTransformed() {
        if (!this.upstreamRequestData) return false;

        const downstreamReq = this.downstream.request;
        const { url, method, rawHeaders, body } = this.upstreamRequestData;

        if (url !== downstreamReq.parsedUrl) return true;
        if (method !== downstreamReq.method) return true;
        if (rawHeaders !== downstreamReq.rawHeaders) return true;

        return false;
    }

    @computed
    public get wasResponseTransformed() {
        if (!this.upstreamResponseData) return false;

        const downstreamRes = this.downstream.response;
        if (downstreamRes === undefined) return false; // Really: we don't know yet.
        if (downstreamRes === 'aborted') {
            return !!this.upstreamResponseData;
        }

        const { statusCode, statusMessage, rawHeaders, body } = this.upstreamResponseData;
        if (statusCode !== downstreamRes.statusCode) return true;
        if (statusMessage !== downstreamRes.statusMessage) return true;
        if (!_.isEqual(rawHeaders, downstreamRes.rawHeaders)) return true;

        return false;
    }

    public get wasTransformed() {
        return this.wasRequestTransformed || this.wasResponseTransformed;
    }

    get httpVersion() {
        return parseHttpVersion(this.request.httpVersion);
    }

    @computed
    public get request(): HtkRequest {
        const downstreamReq = this.downstream.request;

        if (!this.upstreamRequestData) return downstreamReq;
        const { url, method, rawHeaders, body } = this.upstreamRequestData;

        const headers = rawHeaders
            ? rawHeadersToHeaders(rawHeaders)
            : downstreamReq.headers;

        return {
            // These are all general/client related, so just mirrored here:
            id: this.id,
            matchedRuleId: downstreamReq.matchedRuleId,
            remoteIpAddress: downstreamReq.remoteIpAddress,
            remotePort: downstreamReq.remotePort,
            timingEvents: this.timingEvents,
            tags: downstreamReq.tags,

            cache: observable.map(new Map<symbol, unknown>(), { deep: false }),

            parsedUrl: url || downstreamReq.parsedUrl,
            url: url?.toString() || downstreamReq.url,
            protocol: url?.protocol || downstreamReq.parsedUrl.protocol,
            method: method || downstreamReq.method,
            headers: headers,
            rawHeaders: rawHeaders || downstreamReq.rawHeaders,
            body: body || downstreamReq.body,

            source: parseSource(getHeaderValue(headers, 'user-agent')),
            contentType: getContentType(getHeaderValue(headers, 'content-type')) || 'text',

            httpVersion: this.upstreamHttpVersion || downstreamReq.httpVersion,

            // We don't support transforming trailers:
            trailers: downstreamReq.trailers,
            rawTrailers: downstreamReq.rawTrailers,
        };
    }

    @computed
    get response(): HtkResponse | 'aborted' | undefined {
        const downstreamRes = this.downstream.response;
        if (!this.upstreamResponseData) return downstreamRes;

        if (downstreamRes === undefined) return;
        if (downstreamRes === 'aborted' && !this.wasResponseTransformed) {
            return 'aborted';
        }

        const downstreamResData = downstreamRes === 'aborted'
            ? {} as Partial<HtkResponse>
            : downstreamRes;

        const { statusCode, statusMessage, rawHeaders, body } = this.upstreamResponseData;

        return {
            id: this.id,
            timingEvents: this.timingEvents,
            tags: this.tags,

            cache: observable.map(new Map<symbol, unknown>(), { deep: false }),
            contentType: getContentType(getHeaderValue(rawHeaders, 'content-type')) || 'text',

            statusCode,
            statusMessage: statusMessage || '',
            rawHeaders,
            headers: rawHeadersToHeaders(rawHeaders),
            body: body ||
                downstreamResData.body ||
                new HttpBody({ body: Buffer.alloc(0) }, rawHeaders),

            // We don't support transforming trailers:
            trailers: downstreamResData.trailers || {},
            rawTrailers: downstreamResData.rawTrailers || [],

        };
    }

    updateWithRequestHead(upstreamRequest: InputRuleEventDataMap['passthrough-request-head']) {
        const downstreamReq = this.downstream.request;
        const upstreamUrl = upstreamRequestToUrl(upstreamRequest);

        // Mockttp implicitly drops this on all forwarded requests, so we do too during comparison:
        const effectiveDownstreamRawHeaders = downstreamReq.rawHeaders.filter(([key]) =>
            key.toLowerCase() !== 'proxy-connection'
        );

        // If headers are equivalent, store the exact originals (saves memory, makes it easy to
        // detect if there was a difference later).
        const rawHeaders = _.isEqual(upstreamRequest.rawHeaders, effectiveDownstreamRawHeaders)
            ? effectiveDownstreamRawHeaders
            : upstreamRequest.rawHeaders;

        const url = upstreamUrl.toString() === this.downstream.request.parsedUrl.toString()
            ? this.downstream.request.parsedUrl
            : upstreamUrl;

        this.upstreamRequestData = {
            url,
            method: upstreamRequest.method,
            rawHeaders
        };
    }

    updateWithResponseHead(upstreamResponse: InputRuleEventDataMap['passthrough-response-head']) {
        // This is trickier than the request case, because it arrives before the downstream data!
        // Worse still, we can't tell which bits of the head are overridden initially - not until
        // the real response arrives! How inconvenient.

        this.upstreamResponseData = {
            statusCode: upstreamResponse.statusCode,
            statusMessage: upstreamResponse.statusMessage || '',
            rawHeaders: upstreamResponse.rawHeaders
        };
        this.upstreamHttpVersion = upstreamResponse.httpVersion;
    }

    updateWithRequestBody(upstreamRequestBody: InputRuleEventDataMap['passthrough-request-body']) {
        if (!upstreamRequestBody.overridden) return;

        const headers = this.upstreamRequestData!.rawHeaders;
        this.upstreamRequestData!.body = new HttpBody({
            body: asBuffer(upstreamRequestBody.rawBody!)
        }, headers);
    }

    updateWithResponseBody(upstreamResponseData: InputRuleEventDataMap['passthrough-response-body']) {
        if (!upstreamResponseData.overridden) return;

        const headers = this.upstreamResponseData!.rawHeaders;
        // We're storing a full copy of the response body here, but only in the case it was actually
        // overridden, so this shouldn't happen much.
        this.upstreamResponseData!.body = new HttpBody({
            body: asBuffer(upstreamResponseData.rawBody!)
        }, headers);
    }

    isHttp() {
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

    get abortMessage() {
        return this.downstream.abortMessage;
    }

    // Various stub/mirror fields used for compatibility with downstream exchanges:

    get id() {
        return this.downstream.id;
    }

    get matchedRule() {
        return this.downstream.matchedRule;
    }

    get searchIndex() {
        return this.downstream.searchIndex;
    }

    get tags() {
        return this.downstream.tags;
    }

    get timingEvents() {
        return this.downstream.timingEvents;
    }

    get pinned() { return this.downstream.pinned; }
    set pinned(value: boolean) { this.downstream.pinned = value; }

    get hideErrors() { return this.downstream.hideErrors; }
    set hideErrors(value: boolean) { this.downstream.hideErrors = value; }

    readonly requestBreakpoint = undefined;
    readonly responseBreakpoint = undefined;

    get api() {
        return this.downstream.api;
    }

    cleanup() {
        this.cache.clear();

        this.request.cache.clear();
        this.request.body.cleanup();

        if (this.isSuccessfulExchange()) {
            this.response.cache.clear();
            this.response.body.cleanup();
        }
    }

}