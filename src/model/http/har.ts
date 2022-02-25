import * as _ from 'lodash';
import * as dateFns from 'date-fns';
import * as HarFormat from 'har-format';
import * as HarValidator from 'har-validator';
import * as querystring from 'querystring';

import { lastHeader } from '../../util';
import { ObservablePromise } from '../../util/observable';
import {
    Headers,
    HtkRequest,
    HarRequest,
    HarResponse,
    HttpExchange,
    CollectedEvent,
    TimingEvents,
    InputTlsRequest,
    FailedTlsRequest
} from '../../types';

import { UI_VERSION } from '../../services/service-versions';
import { isHttpExchange } from './exchange';

// We only include request/response bodies that are under 500KB
const HAR_BODY_SIZE_LIMIT = 500000;
const UTF8Decoder = new TextDecoder('utf8', { fatal: true });

export interface Har extends HarFormat.Har {
    log: HarLog;
}

interface HarLog extends HarFormat.Log {
    // Custom field to expose failed TLS connections
    _tlsErrors: HarTlsErrorEntry[];
}

export type RequestContentData = {
    text: string;
    size: number;
    encoding?: 'base64';
    comment?: string;
};

interface ExtendedHarRequest extends HarFormat.Request {
    _postDataDiscarded?: boolean;
    _content?: RequestContentData;
}

export type HarEntry = HarFormat.Entry;
export type HarTlsErrorEntry = {
    startedDateTime: string;
    time: number; // Floating-point high-resolution duration, in ms
    hostname?: string; // Undefined if connection fails before hostname received
    cause: FailedTlsRequest['failureCause'];

    clientIPAddress: string;
    clientPort: number;
}

export async function generateHar(events: CollectedEvent[]): Promise<Har> {
    const [exchanges, errors] = _.partition(events, isHttpExchange) as [
        HttpExchange[], FailedTlsRequest[]
    ];

    const sourcePages = getSourcesAsHarPages(exchanges);
    const entries = await Promise.all(exchanges.map(generateHarEntry));
    const errorEntries = errors.map(generateHarTlsError);

    return {
        log: {
            version: "1.2",
            creator: {
                name: "HTTP Toolkit",
                version: UI_VERSION
            },
            pages: sourcePages,
            entries,
            _tlsErrors: errorEntries
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

function asHtkHeaders(headers: HarFormat.Header[]) {
    return _(headers)
        .keyBy((header) => header.name)
        .mapKeys((_, headerName) => headerName.toLowerCase())
        .mapValues((header) => header.value)
        .value() as Headers;
}

export function generateHarRequest(
    request: HtkRequest,
    waitForDecoding?: false
): ExtendedHarRequest;
export function generateHarRequest(
    request: HtkRequest,
    waitForDecoding: true
): ExtendedHarRequest | ObservablePromise<ExtendedHarRequest>;
export function generateHarRequest(
    request: HtkRequest,
    waitForDecoding = false
): ExtendedHarRequest | ObservablePromise<ExtendedHarRequest> {
    if (waitForDecoding && (
        !request.body.decodedPromise.state ||
        request.body.decodedPromise.state === 'pending'
    )) {
        return request.body.decodedPromise.then(() => generateHarRequest(request));
    }

    const requestEntry: ExtendedHarRequest = {
        method: request.method,
        url: request.parsedUrl.toString(),
        httpVersion: `HTTP/${request.httpVersion || '1.1'}`,
        cookies: [],
        headers: asHarHeaders(request.headers),
        queryString: Array.from(request.parsedUrl.searchParams.entries()).map(
            ([paramKey, paramValue]) => ({
                name: paramKey,
                value: paramValue
            })
        ),
        headersSize: -1,
        bodySize: request.body.encoded.byteLength
    };

    if (request.body.decoded) {
        if (request.body.decoded.byteLength > HAR_BODY_SIZE_LIMIT) {
            requestEntry._postDataDiscarded = true;
            requestEntry.comment = `Body discarded during HAR generation: longer than limit of ${HAR_BODY_SIZE_LIMIT} bytes`;
        } else {
            try {
                requestEntry.postData = generateHarPostBody(
                    UTF8Decoder.decode(request.body.decoded),
                    lastHeader(request.headers['content-type']) || 'application/octet-stream'
                );
            } catch (e) {
                if (e instanceof TypeError) {
                    requestEntry._content = {
                        text: request.body.decoded.toString('base64'),
                        size: request.body.decoded.byteLength,
                        encoding: 'base64',
                    }
                } else {
                    throw e;
                }
            }
        }
    }

    return requestEntry;
}

type TextBody = {
    mimeType: string,
    text: string
};

type ParamBody = {
    mimeType: string,
    params: HarFormat.Param[]
}

function generateHarPostBody(body: string | false, mimeType: string): TextBody | ParamBody | undefined {
    if (!body) return;

    if (mimeType === 'application/x-www-form-urlencoded') {
        let parsedBody: querystring.ParsedUrlQuery | undefined;

        try {
            parsedBody = querystring.parse(body);
        } catch (e) {
            console.log('Failed to parse url encoded body', body);
        }

        if (parsedBody) {
            // URL encoded data - expose this explicitly
            return {
                mimeType,
                params: generateHarParamsFromParsedQuery(parsedBody)
            };
        } else {
            // URL encoded but not parseable so just use the raw data
            return {
                mimeType,
                text: body
            };
        }
    } else {
        // Not URL encoded, so just use the raw data
        return {
            mimeType,
            text: body
        };
    }
}

function generateHarParamsFromParsedQuery(query: querystring.ParsedUrlQuery): HarFormat.Param[] {
    const queryEntries = _.flatMap(Object.entries(query), ([key, value]): Array<[string, string]> => {
        if (_.isString(value)) return [[key, value]];
        else return value!.map((innerValue) => [
            key, innerValue
        ]);
    });

    return queryEntries.map(([key, value]) => ({
        name: key,
        value
    }));
}

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
            responseContent = { text: UTF8Decoder.decode(decoded) };
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
                mimeType: lastHeader(response.headers['content-type']) ||
                    'application/octet-stream',
                size: response.body.decoded?.byteLength || 0
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
    const waitDuration = 'bodyReceivedTimestamp' in timingEvents && 'headersSentTimestamp' in timingEvents
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

function generateHarTlsError(event: FailedTlsRequest): HarTlsErrorEntry {
    const timingEvents = event.timingEvents ?? {};

    const startTime = 'startTime' in timingEvents
        ? timingEvents.startTime
        : new Date();

    const failureDuration = 'failureTimestamp' in timingEvents
        ? timingEvents.failureTimestamp - timingEvents.connectTimestamp
        : 0;

    return {
        startedDateTime: dateFns.format(startTime),
        time: failureDuration,
        cause: event.failureCause,
        hostname: event.hostname,
        clientIPAddress: event.remoteIpAddress,
        clientPort: event.remotePort
    };
}

export type ParsedHar = {
    requests: HarRequest[],
    responses: HarResponse[],
    aborts: HarRequest[],
    tlsErrors: InputTlsRequest[]
};

const sumTimings = (
    timings: HarFormat.Timings,
    ...keys: Array<keyof HarFormat.Timings>
): number =>
    _.sumBy(keys, (k) => {
        const v = Number(timings[k]);
        if (!v || v < 0) return 0;
        else return v;
    });

export async function parseHar(harContents: unknown): Promise<ParsedHar> {
    const har = await HarValidator.har(cleanRawHarData(harContents)) as Har;

    const baseId = _.random(1_000_000) + '-';

    const requests: HarRequest[] = [];
    const responses: HarResponse[] = [];
    const aborts: HarRequest[] = [];
    const tlsErrors: InputTlsRequest[] = [];

    har.log.entries.forEach((entry, i) => {
        const id = baseId + i;

        const timingEvents: TimingEvents = Object.assign({
            startTime: dateFns.parse(entry.startedDateTime).getTime(),
            startTimestamp: 0,
            bodyReceivedTimestamp: sumTimings(entry.timings,
                'blocked',
                'dns',
                'connect',
                'send'
            ),
            headersSentTimestamp: sumTimings(entry.timings,
                'blocked',
                'dns',
                'connect',
                'send',
                'wait'
            )
        }, entry.response.status !== 0
            ? { responseSentTimestamp: entry.time }
            : { abortedTimestamp: entry.time }
        );

        const request = parseHarRequest(id, entry.request, timingEvents);
        requests.push(request);

        if (entry.response.status !== 0) {
            responses.push(parseHarResponse(id, entry.response, timingEvents));
        } else {
            aborts.push(request);
        }
    });

    if (har.log._tlsErrors) {
        har.log._tlsErrors.forEach((entry, i) => {
            tlsErrors.push({
                failureCause: entry.cause,
                hostname: entry.hostname,
                remoteIpAddress: entry.clientIPAddress,
                remotePort: entry.clientPort,
                tags: [],
                timingEvents: {
                    startTime: dateFns.parse(entry.startedDateTime).getTime(),
                    connectTimestamp: 0,
                    failureTimestamp: entry.time
                }
            });
        });
    }

    return { requests, responses, aborts, tlsErrors };
}

// Mutatively cleans & returns the HAR, to tidy up irrelevant but potentially
// problematic details & ensure we can parse it, if at all possible.
function cleanRawHarData(harContents: any) {
    const entries = harContents?.log?.entries ?? [];

    // Some HAR exports include invalid serverIPAddresses, which fail validation.
    // Somebody is wrong here, but we don't really care - just drop it entirely.
    entries.forEach((entry: any) => {
        if (entry.serverIPAddress === "") {
            delete entry.serverIPAddress;
        }

        if (entry.serverIPAddress === "[::1]") {
            entry.serverIPAddress = "::1";
        }

        // FF fails to write headersSize or writes null for req/res that has no headers.
        // We don't use it anyway - set it to -1 if it's missing
        if (entry.request) entry.request.headersSize ??= -1;
        if (entry.response) entry.response.headersSize ??= -1;

        // Firefox fails to write timing data for some requests, e.g. requests blocked
        // by adblocker extensions: https://bugzilla.mozilla.org/show_bug.cgi?id=1716335
        if (entry.timings) {
            entry.timings.send ??= -1;
            entry.timings.wait ??= -1;
            entry.timings.receive ??= -1;
        }

        if (entry.response?.content) {
            // Similarly, when there's no actual response some fields can be missing. Note that
            // 'content' is response only, but we don't use these fields anyway:
            entry.response.content.size ??= -1;
            entry.response.content.mimeType ??= 'application/octet-stream';
        }

        if (entry.response && entry.response.bodySize === null) {
            // Firefox sometimes sets bodySize to null, even when there is clearly a body being received.
            // Fall back to content-length if available, or use -1 if not.
            // We do want to use this where it's available so this is a bit annoying, but c'est la vie:
            // it's not super important data (just used to compare compression perf) and there's no much
            // we can do when the imported file contains invalid data like this.
            const contentLengthHeader = _.find(entry.response.headers || [],
                ({ name }) => name.toLowerCase() === 'content-length'
            );
            if (contentLengthHeader) {
                entry.response.bodySize = parseInt(contentLengthHeader.value, 10);
            } else {
                entry.response.bodySize = -1;
            }
        }
    });

    const pages = harContents?.log?.pages ?? [];
    pages.forEach((page: any) => {
        // FF doesn't give pages their (required) titles:
        if (page.title === undefined) page.title = page.id;
    });

    return harContents;
}

function parseHarRequest(
    id: string,
    request: ExtendedHarRequest,
    timingEvents: TimingEvents
): HarRequest {
    const parsedUrl = new URL(request.url);

    return {
        id,
        timingEvents,
        tags: [],
        matchedRuleId: "?",
        protocol: request.url.split(':')[0],
        method: request.method,
        url: request.url,
        path: parsedUrl.pathname,
        hostname: parsedUrl.hostname,
        // We need to promise it has a 'host' header (i.e. the headers are
        // legal for an HTTP request):
        headers: asHtkHeaders(request.headers) as Headers & { host: string },
        body: {
            decoded: request._content
                ? parseHarRequestContents(request._content)
                : parseHarPostData(request.postData),
            encodedLength: request.bodySize
        }
    }
}

function parseHarRequestContents(data: RequestContentData): Buffer {
    if (data.encoding && Buffer.isEncoding(data.encoding)) {
        return Buffer.from(data.text, data.encoding);
    }

    throw TypeError("Invalid encoding");
}

function parseHarPostData(data: HarFormat.PostData | undefined): Buffer {
    if (!data) {
        return Buffer.from('');
    } else if (data.params) {
        return Buffer.from(
            // Go from array of key-value objects to object of key -> value array:
            querystring.stringify(_(data.params)
                .groupBy(({ name }) => name)
                .mapValues((params) => params.map(p => p.value || ''))
                .valueOf()
            )
        );
    } else {
        return Buffer.from(data.text, 'utf8');
    }
}

function parseHarResponse(
    id: string,
    response: HarFormat.Response,
    timingEvents: TimingEvents
): HarResponse {
    return {
        id,
        timingEvents,
        tags: [],
        statusCode: response.status,
        statusMessage: response.statusText,
        headers: asHtkHeaders(response.headers),
        body: {
            decoded: Buffer.from(
                response.content.text || '',
                response.content.encoding as BufferEncoding || 'utf8'
            ),
            encodedLength: (!response.bodySize || response.bodySize === -1)
                ? 0 // If bodySize is missing or inaccessible, just zero it
                : response.bodySize
        }
    }
}