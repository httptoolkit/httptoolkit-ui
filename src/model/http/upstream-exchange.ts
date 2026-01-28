import * as _ from 'lodash';
import { IReactionDisposer, autorun, computed, observable } from 'mobx';

import {
    HtkRequest,
    RawHeaders,
    InputRuleEventDataMap,
    HtkResponse
} from '../../types';

import { getHeaderValue, rawHeadersToHeaders, withoutPseudoHeaders } from './headers';
import { ParsedUrl } from '../../util/url';
import { asBuffer } from '../../util/buffer';

import { getContentType } from '../events/content-types';
import { HttpBody } from './http-body';
import { HttpExchange, parseHttpVersion } from './http-exchange';
import { HttpExchangeViewBase, HttpExchangeView } from './http-exchange-views';
import { parseSource } from './sources';
import { ObservableCache } from '../observable-cache';
import { ApiStore } from '../api/api-store';

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
export class UpstreamHttpExchange extends HttpExchangeViewBase implements HttpExchangeView {

    constructor(downstream: HttpExchange, apiStore: ApiStore) {
        super(downstream, apiStore);
    }

    // An autorun, which ensures the request & response are kept observed & updated for as long
    // as this upstream exchange exists (until cleanup);
    private computedKeepAlive = {
        dispose: autorun(() => { this.request; this.response; })
    };

    get upstream(): UpstreamHttpExchange {
        return this;
    }

    @observable
    private upstreamHttpVersion: string | undefined;

    @observable
    private upstreamRequestData: {
        // Fields here are undefined if they're the same as the downstream request
        url?: ParsedUrl,
        method?: string,
        rawHeaders?: RawHeaders,
        body?: HttpBody
    } | undefined;

    @observable
    private upstreamResponseData:
        | {
            statusCode?: number,
            statusMessage?: string | undefined,
            rawHeaders?: RawHeaders,
            body?: HttpBody
        }
        | 'aborted'
        | undefined;

    @observable
    private upstreamAbortMessage: string | undefined; // Only set if upstream response is aborted

    @computed
    public get wasRequestTransformed() {
        if (!this.upstreamRequestData) return false;

        const { url, method, rawHeaders, body } = this.upstreamRequestData;
        return !!(url || method || rawHeaders || body);
    }

    @computed
    public get wasResponseTransformed() {
        if (!this.upstreamResponseData) return false;

        const downstreamRes = this.downstream.response;
        if (downstreamRes === undefined) return false; // Really: we don't know yet.

        if (downstreamRes === 'aborted') {
            return this.upstreamResponseData !== 'aborted';
        } else if (this.upstreamResponseData === 'aborted') {
            return true;
        }

        const { statusCode, statusMessage, rawHeaders, body } = this.upstreamResponseData;
        return !!(statusCode || statusMessage || rawHeaders || body);
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

            cache: new ObservableCache(),

            parsedUrl: url || downstreamReq.parsedUrl,
            url: url?.toString() || downstreamReq.url,
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

        if (this.upstreamResponseData === 'aborted') {
            return 'aborted';
        } else if (downstreamRes === 'aborted' || !downstreamRes) {
            // Downstream is aborted or pending, so upstream data (if any) is all we have

            if (downstreamRes && !this.wasResponseTransformed) return 'aborted';

            const { statusCode, statusMessage, rawHeaders, body } = this.upstreamResponseData as
                Required<typeof this.upstreamResponseData>; // If downstream is aborted, upstream data is complete

            return {
                id: this.id,
                timingEvents: this.timingEvents,
                tags: this.tags,

                cache: new ObservableCache(),
                contentType: getContentType(getHeaderValue(rawHeaders, 'content-type')) || 'text',

                statusCode: statusCode,
                statusMessage: statusMessage || '',
                rawHeaders,
                headers: rawHeadersToHeaders(rawHeaders),
                body: body || new HttpBody({ body: Buffer.alloc(0) }, rawHeaders),
                trailers: {},
                rawTrailers: []
            };
        } else {
            // We have downstream data, and upstream just for the cases that differ:
            const { statusCode, statusMessage, rawHeaders, body } = this.upstreamResponseData;

            const headers = rawHeaders
                ? rawHeadersToHeaders(rawHeaders)
                : downstreamRes.headers;

            return {
                id: this.id,
                timingEvents: this.timingEvents,
                tags: this.tags,

                cache: new ObservableCache(),
                contentType: getContentType(getHeaderValue(headers, 'content-type')) || 'text',

                statusCode: statusCode || downstreamRes.statusCode,
                statusMessage: statusMessage || '',
                rawHeaders: rawHeaders || downstreamRes.rawHeaders,
                headers: headers,
                body: body ||
                    downstreamRes.body ||
                    new HttpBody({ body: Buffer.alloc(0) }, headers),

                // We don't support transforming trailers:
                trailers: downstreamRes.trailers || {},
                rawTrailers: downstreamRes.rawTrailers || [],
            };
        }
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
        const rawHeaders = !_.isEqual(
            withoutPseudoHeaders(upstreamRequest.rawHeaders),
            withoutPseudoHeaders(effectiveDownstreamRawHeaders)
        )
            ? upstreamRequest.rawHeaders
            : undefined; // If unchanged, we drop the duplicate and just read through to downstream

        const url = upstreamUrl.toString() !== this.downstream.request.parsedUrl.toString()
            ? upstreamUrl
            : undefined

        const method = upstreamRequest.method !== this.downstream.request.method
            ? upstreamRequest.method
            : undefined;

        this.upstreamRequestData = {
            url,
            method,
            rawHeaders
        };
    }

    updateWithResponseHead(upstreamResponse: InputRuleEventDataMap['passthrough-response-head']) {
        // This is trickier than the request case, because it arrives before the downstream data!
        // Worse still, we can't tell which bits of the head are overridden initially - not until
        // the real response arrives! How inconvenient. To handle this, we initially store everything,
        // and then we clear it up once the downstream response arrives.
        this.upstreamResponseData = {
            statusCode: upstreamResponse.statusCode,
            statusMessage: upstreamResponse.statusMessage || '',
            rawHeaders: upstreamResponse.rawHeaders
        };
        this.upstreamHttpVersion = upstreamResponse.httpVersion;
    }

    updateWithRequestBody(upstreamRequestBody: InputRuleEventDataMap['passthrough-request-body']) {
        if (!upstreamRequestBody.overridden) return;

        const headers = this.upstreamRequestData!.rawHeaders
            ?? this.downstream.request.rawHeaders;
        this.upstreamRequestData!.body = new HttpBody({
            body: asBuffer(upstreamRequestBody.rawBody!)
        }, headers);
    }

    updateWithResponseBody(upstreamResponseData: InputRuleEventDataMap['passthrough-response-body']) {
        if (!upstreamResponseData.overridden || this.upstreamResponseData === 'aborted') return;

        const headers = this.upstreamResponseData?.rawHeaders
            || (this.downstream.isSuccessfulExchange() && this.downstream.response.rawHeaders)
            || [];

        // We're storing a full copy of the response body here, but only in the case it was actually
        // overridden, so this shouldn't happen much.
        this.upstreamResponseData!.body = new HttpBody({
            body: asBuffer(upstreamResponseData.rawBody!)
        }, headers);
    }


    // Once the downstream response arrives, we can clear up our upstream data, to store
    // only the data that's actually different.
    updateAfterDownstreamResponse(response: HtkResponse | 'aborted') {
        if (
            !this.upstreamResponseData ||
            this.upstreamResponseData === 'aborted' ||
            response === 'aborted'
        ) return;

        if (this.upstreamResponseData.statusCode === response.statusCode) {
            delete this.upstreamResponseData.statusCode;
        }

        if (this.upstreamResponseData.statusMessage === response.statusMessage) {
            delete this.upstreamResponseData.statusMessage;
        }

        if (_.isEqual(
            withoutPseudoHeaders(this.upstreamResponseData.rawHeaders ?? []),
            withoutPseudoHeaders(response.rawHeaders)
        )) {
            delete this.upstreamResponseData.rawHeaders;
        }
    }

    updateFromUpstreamAbort(abort: InputRuleEventDataMap['passthrough-abort']) {
        this.upstreamResponseData = 'aborted';

        const { error } = abort;

        this.upstreamAbortMessage = error.message ?? 'Unknown error';

        // Prefix the code if not already present (often happens e.g. ECONNRESET)
        if (error.code && !this.upstreamAbortMessage?.includes(error.code)) {
            this.upstreamAbortMessage = `${error.code}: ${this.upstreamAbortMessage}`;
        }
    }

    get abortMessage() {
        return this.upstreamResponseData === 'aborted'
            ? this.upstreamAbortMessage!
        : this.wasResponseTransformed
            ? undefined
        // Not transformed/aborted - just mirror downstream
            : this.downstream.abortMessage;
    }



    cleanup() {
        this.computedKeepAlive.dispose();
        this.request.cache.clear();
        this.request.body.cleanup();

        if (this.isSuccessfulExchange()) {
            this.response?.cache.clear();
            this.response?.body.cleanup();
        }
    }

}