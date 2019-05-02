import * as _ from 'lodash';
import { get } from 'typesafe-get';
import * as dateFns from 'date-fns';
import * as HarFormat from 'har-format';

import { UI_VERSION, ObservablePromise } from '../util';
import { Headers } from '../types';

import { HttpExchange } from "./exchange";
import { HtkRequest } from '../types';

export type Har = HarFormat.Har;
export type HarEntry = HarFormat.Entry;

export async function generateHar(exchanges: HttpExchange[]): Promise<Har> {
    const sourcePages = getSourcesAsHarPages(exchanges);
    const entries = await Promise.all(exchanges.map(generateHarEntry));

    return {
        log: {
            version: "1.2",
            creator: {
                name: "HTTP Toolkit",
                version: UI_VERSION
            },
            pages: sourcePages,
            entries: entries
        }
    };
}

function asHarHeaders(headers: Headers) {
    return _.map(headers, (headerValue, headerKey) => ({
        name: headerKey,
        value: _.isArray(headerValue)
            ? headerValue.join(',')
            : headerValue!
    }))
}

function paramsToEntries(params: URLSearchParams): Array<[string, string]> {
    // In theory params.entries() should exist, but TS disagrees
    if ('entries' in params) {
        return Array.from((params as any).entries());
    }

    const entries: Array<[string, string]> = [];
    params.forEach((value, key) => {
        entries.push([key, value]);
    });
    return entries;
}

// We only include request/response bodies that are under 40KB
const HAR_BODY_SIZE_LIMIT = 40960;

export function generateHarRequest(request: HtkRequest, waitForDecoding?: false): HarFormat.Request;
export function generateHarRequest(
    request: HtkRequest,
    waitForDecoding: true
): HarFormat.Request | ObservablePromise<HarFormat.Request>;
export function generateHarRequest(
    request: HtkRequest,
    waitForDecoding = false
): HarFormat.Request | ObservablePromise<HarFormat.Request> {
    if (waitForDecoding && (
        !request.body.decodedPromise.state ||
        request.body.decodedPromise.state === 'pending'
    )) {
        return request.body.decodedPromise.then(() => generateHarRequest(request));
    }

    const bodyText = !!request.body.decoded &&
        request.body.decoded.byteLength <= HAR_BODY_SIZE_LIMIT &&
        request.body.decoded.toString('utf8');

    return {
        method: request.method,
        url: request.parsedUrl.toString(),
        httpVersion: `HTTP/${request.httpVersion || '1.1'}`,
        cookies: [],
        headers: asHarHeaders(request.headers),
        queryString: paramsToEntries(request.parsedUrl.searchParams).map(
            ([paramKey, paramValue]) => ({
                name: paramKey,
                value: paramValue
            })
        ),
        postData: bodyText
            ? {
                mimeType: request.headers['content-type'] || 'application/octet-stream',
                text: bodyText,
                params: []
            }
            : undefined,
        headersSize: -1,
        bodySize: request.body.encoded.byteLength
    };
}

const harResponseDecoder = new TextDecoder('utf8', { fatal: true });

async function generateHarResponse(exchange: HttpExchange): Promise<HarFormat.Response> {
    const { request, response } = exchange;

    if (!response || response === 'aborted') {
        return {
            status: 0,
            statusText: "",
            httpVersion: "",
            headers: [],
            cookies: [],
            content: { size: 0, mimeType: "application/x-unknown" },
            redirectURL: "",
            headersSize: -1,
            bodySize: -1
        };
    }

    const decoded = await response.body.decodedPromise;

    let responseContent: { text: string, encoding?: string } | {};
    try {
        if (!decoded || decoded.byteLength > HAR_BODY_SIZE_LIMIT) {
            // If no body or the body is too large, don't include it
            responseContent = {};
        } else {
            // If body decodes as text, keep it as text
            responseContent = { text: harResponseDecoder.decode(decoded) };
        }
    } catch (e) {
        // If body doesn't decode as text, base64 encode it
        responseContent = {
            text: decoded!.toString('base64'),
            encoding: 'base64'
        };
    }

    return {
        status: response.statusCode,
        statusText: response.statusMessage,
        httpVersion: `HTTP/${request.httpVersion || '1.1'}`,
        cookies: [],
        headers: asHarHeaders(response.headers),
        content: Object.assign(
            {
                mimeType: response.headers['content-type'] || 'application/octet-stream',
                size: get(response.body.decoded, 'byteLength') || 0
            },
            responseContent
        ),
        redirectURL: "",
        headersSize: -1,
        bodySize: response.body.encoded.byteLength || 0
    };
}

function getSourcesAsHarPages(exchanges: HttpExchange[]): HarFormat.Page[] {
    const exchangesBySource = _.groupBy(exchanges, (e) =>
        e.request.source.summary
    );

    return _.map(exchangesBySource, (exchanges, source) => {
        const sourceStartTime = Math.min(...exchanges.map(e =>
            'startTime' in e.timingEvents
                ? e.timingEvents.startTime
                : Date.now()
        ));

        return {
            id: source,
            title: source,
            startedDateTime: dateFns.format(sourceStartTime),
            pageTimings: {}
        }
    });
}

async function generateHarEntry(exchange: HttpExchange): Promise<HarEntry> {
    const { timingEvents } = exchange;

    const startTime = 'startTime' in timingEvents
        ? timingEvents.startTime
        : new Date();

    const sendDuration = 'bodyReceivedTimestamp' in timingEvents
        ? timingEvents.bodyReceivedTimestamp! - timingEvents.startTimestamp
        : 0;
    const waitDuration = 'headersSentTimestamp' in timingEvents
        ? timingEvents.headersSentTimestamp! - timingEvents.bodyReceivedTimestamp!
        : 0;
    const receiveDuration = 'responseSentTimestamp' in timingEvents
        ? timingEvents.responseSentTimestamp! - timingEvents.headersSentTimestamp!
        : 0;
    const totalDuration = 'responseSentTimestamp' in timingEvents
        ? timingEvents.responseSentTimestamp! - timingEvents.startTimestamp!
        : -1;

    return {
        pageref: exchange.request.source.summary,
        startedDateTime: dateFns.format(startTime),
        time: totalDuration,
        request: await generateHarRequest(exchange.request, true),
        response: await generateHarResponse(exchange),
        cache: {},
        timings: {
            blocked: -1,
            dns: -1,
            connect: -1,
            ssl: -1,
            // These can be negative when events overlap. E.g. if we mock a response we may
            // send the response before the request has been completed. In that case, we
            // just 0 the values for now, because these 3 are required >= 0 by the HAR spec
            // TODO: In future, more clearly express that.
            send: Math.max(sendDuration, 0),
            wait: Math.max(waitDuration, 0),
            receive: Math.max(receiveDuration, 0)
        }
    };
}