import * as _ from 'lodash';
import * as dateFns from 'date-fns';
import * as HarFormat from 'har-format';
import * as HarValidator from 'har-validator';
import * as querystring from 'querystring';

import {
    Headers,
    HtkRequest,
    HarRequest,
    HarResponse,
    HttpExchange,
    CollectedEvent,
    TimingEvents,
    FailedTlsConnection,
    InputWebSocketMessage,
    TlsSocketMetadata
} from '../../types';

import { stringToBuffer } from '../../util/buffer';
import { lastHeader } from '../../util/headers';
import { ObservablePromise } from '../../util/observable';
import { unreachableCheck } from '../../util/error';

import { UI_VERSION } from '../../services/service-versions';
import { getStatusMessage } from './http-docs';
import { StreamMessage } from '../events/stream-message';
import { QueuedEvent } from '../events/events-store';

// We only include request/response bodies that are under 500KB
const HAR_BODY_SIZE_LIMIT = 500000;
const UTF8Decoder = new TextDecoder('utf8', { fatal: true });

export interface Har extends HarFormat.Har {
    log: HarLog;
}

export interface HarGenerationOptions {
    bodySizeLimit: number;
}

interface HarLog extends HarFormat.Log {
    // Custom field to expose failed TLS connections
    _tlsErrors: HarTlsErrorEntry[];

    // Our extended version of HAR entries:
    entries: HarEntry[];
}

export type RequestContentData = {
    text: string;
    size: number;
    encoding?: 'base64';
    comment?: string;
};

export interface ExtendedHarRequest extends HarFormat.Request {
    _requestBodyStatus?:
        | 'discarded:too-large'
        | 'discarded:not-representable'
        | 'discarded:not-decodable';
    _content?: RequestContentData;
}

export interface HarEntry extends HarFormat.Entry {
    _resourceType?: 'websocket';
    _webSocketMessages?: HarWebSocketMessage[];
    _webSocketClose?: {
        code?: number;
        reason?: string;
        timestamp?: number;
    } | 'aborted'
    _pinned?: true;
}

export interface HarWebSocketMessage {
    type: 'send' | 'receive';
    opcode: 1 | 2;
    data: string;
    time: number; // Epoch timestamp, as a float in seconds
}

export type HarTlsErrorEntry = {
    startedDateTime: string;
    time: number; // Floating-point high-resolution duration, in ms
    hostname?: string; // Undefined if connection fails before hostname received
    cause: FailedTlsConnection['failureCause'];

    tlsMetadata?: TlsSocketMetadata;

    clientIPAddress: string;
    clientPort: number;
}

export async function generateHar(
    events: CollectedEvent[],
    options: HarGenerationOptions = { bodySizeLimit: HAR_BODY_SIZE_LIMIT }
): Promise<Har> {
    const [exchanges, otherEvents] = _.partition(events, e => e.isHttp()) as [
        HttpExchange[], CollectedEvent[]
    ];

    const errors = otherEvents.filter(e => e.isTlsFailure()) as FailedTlsConnection[];

    const sourcePages = getSourcesAsHarPages(exchanges);
    const entries = await Promise.all(exchanges.map(e => generateHarHttpEntry(e, options)));
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
    waitForDecoding: false,
    options: HarGenerationOptions
): ExtendedHarRequest;
export function generateHarRequest(
    request: HtkRequest,
    waitForDecoding: true,
    options: HarGenerationOptions
): ExtendedHarRequest | ObservablePromise<ExtendedHarRequest>;
export function generateHarRequest(
    request: HtkRequest,
    waitForDecoding: boolean,
    options: HarGenerationOptions
): ExtendedHarRequest | ObservablePromise<ExtendedHarRequest> {
    if (waitForDecoding && (
        !request.body.decodedPromise.state ||
        request.body.decodedPromise.state === 'pending'
    )) {
        return request.body.decodedPromise.then(() =>
            generateHarRequest(request, false, options)
        );
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
        if (request.body.decoded.byteLength > options.bodySizeLimit) {
            requestEntry._requestBodyStatus = 'discarded:too-large';
            requestEntry.comment = `Body discarded during HAR generation: longer than limit of ${
                options.bodySizeLimit
            } bytes`;
        } else {
            try {
                requestEntry.postData = generateHarPostBody(
                    UTF8Decoder.decode(request.body.decoded),
                    lastHeader(request.headers['content-type']) || 'application/octet-stream'
                );
            } catch (e) {
                if (e instanceof TypeError) {
                    requestEntry._requestBodyStatus = 'discarded:not-representable';
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
    } else {
        requestEntry._requestBodyStatus = 'discarded:not-decodable';
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
                params: generateHarParamsFromParsedQuery(parsedBody),
                // The spec says we shouldn't export params & text at the same time, but Chrome & FF do,
                // it's required for full imports there in some cases, and it's useful to ensure we're
                // perfectly reproducing the original body format.
                text: body
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

async function generateHarResponse(
    exchange: HttpExchange,
    options: HarGenerationOptions
): Promise<HarFormat.Response> {
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

    let responseContent: { text: string, encoding?: string } | { comment: string};
    try {
        if (!decoded || decoded.byteLength > options.bodySizeLimit) {
            // If no body or the body is too large, don't include it
            responseContent = {
                comment: `Body discarded during HAR generation: longer than limit of ${
                    options.bodySizeLimit
                } bytes`
            };
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
            e.timingEvents.startTime ?? Date.now()
        ), Date.now());

        return {
            id: source,
            title: source,
            startedDateTime: dateFns.format(sourceStartTime),
            pageTimings: {}
        }
    });
}

async function generateHarHttpEntry(
    exchange: HttpExchange,
    options: HarGenerationOptions
): Promise<HarEntry> {
    const { timingEvents } = exchange;

    const startTime = timingEvents.startTime ?? Date.now();

    const sendDuration = timingEvents.bodyReceivedTimestamp
        ? timingEvents.bodyReceivedTimestamp! - timingEvents.startTimestamp!
        : 0;
    const waitDuration = timingEvents.bodyReceivedTimestamp && timingEvents.headersSentTimestamp
        ? timingEvents.headersSentTimestamp - timingEvents.bodyReceivedTimestamp
        : 0;
    const receiveDuration = timingEvents.responseSentTimestamp
        ? timingEvents.responseSentTimestamp! - timingEvents.headersSentTimestamp!
        : 0;

    const endTimestamp = timingEvents.wsClosedTimestamp ??
        timingEvents.responseSentTimestamp ??
        timingEvents.abortedTimestamp;

    const totalDuration = endTimestamp
        ? endTimestamp - timingEvents.startTimestamp!
        : -1;

    return {
        pageref: exchange.request.source.summary,
        startedDateTime: dateFns.format(startTime),
        time: totalDuration,
        request: await generateHarRequest(exchange.request, true, options),
        response: await generateHarResponse(exchange, options),
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
        },
        _pinned: exchange.pinned || undefined,

        ...(exchange.isWebSocket() ? {
            _resourceType: 'websocket',
            _webSocketMessages: exchange.messages.map((message) =>
                generateHarWebSocketMessage(message, timingEvents)
            ),
            _webSocketClose: exchange.closeState && exchange.closeState !== 'aborted'
                ? {
                    code: exchange.closeState.closeCode,
                    reason: exchange.closeState.closeReason,
                    timestamp: timingEvents.wsClosedTimestamp
                        ? timingEvents.wsClosedTimestamp / 1000 // Match _webSocketMessage format
                        : undefined
                }
                : exchange.closeState
        } : {})
    };
}

function generateHarWebSocketMessage(
    message: StreamMessage,
    timingEvents: Partial<TimingEvents>
): HarWebSocketMessage {
    return {
        // Note that msg.direction is from the perspective of Mockttp, not the client.
        type: message.direction === 'sent'
                ? 'receive'
            : message.direction === 'received'
                ? 'send'
            : unreachableCheck(message.direction),

        opcode: message.isBinary ? 2 : 1,
        data: message.isBinary
            ? message.content.toString('base64')
            : message.content.toString('utf8'),

        // N.b. timestamp is precise but relative, startTime is epoch-based but imprecise,
        // eventual result here has to be in seconds as a float.
        time: (timingEvents.startTime! + (message.timestamp - timingEvents.startTimestamp!)) / 1000
    };
}

function generateHarTlsError(event: FailedTlsConnection): HarTlsErrorEntry {
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
        hostname: event.upstreamHostname,
        clientIPAddress: event.remoteIpAddress,
        clientPort: event.remotePort,
        tlsMetadata: event.tlsMetadata
    };
}

export interface ParsedHar {
    events: QueuedEvent[];
    pinnedIds: string[];
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

    const events: QueuedEvent[] = [];
    const pinnedIds: string[] = []

    har.log.entries.forEach((entry, i) => {
        const id = baseId + i;
        const isWebSocket = entry._resourceType === 'websocket';

        const timingEvents: TimingEvents = {
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
        };

        Object.assign(timingEvents,
            entry.response.status !== 0
                ? { responseSentTimestamp: entry.time }
                : { abortedTimestamp: entry.time },

            isWebSocket
                ? {
                    wsAcceptedTimestamp: timingEvents.headersSentTimestamp,
                    wsClosedTimestamp: entry.time
                }
                : {}
        );


        const request = parseHarRequest(id, entry.request, timingEvents);

        events.push({
            type: isWebSocket ? 'websocket-request' : 'request',
            event: request
        });

        if (entry.response.status !== 0) {
            events.push({
                type: isWebSocket && entry.response.status === 101
                    ? 'websocket-accepted'
                    : 'response',
                event: parseHarResponse(id, entry.response, timingEvents)
            });
        } else {
            events.push({ type: 'abort', event: request });
        }

        if (isWebSocket) {
            events.push(...entry._webSocketMessages?.map(message => ({
                type: `websocket-message-${message.type === 'send' ? 'received' : 'sent'}` as const,
                event: {
                    streamId: request.id,
                    direction: message.type === 'send' ? 'received' : 'sent',
                    isBinary: message.opcode === 2,
                    content: Buffer.from(message.data, message.opcode === 2 ? 'base64' : 'utf8'),
                    eventTimestamp: (message.time * 1000) - timingEvents.startTime,
                    timingEvents: timingEvents,
                    tags: []
                } satisfies InputWebSocketMessage
            })) ?? []);

            const closeEvent = entry._webSocketClose;

            if (closeEvent && closeEvent !== 'aborted') {
                events.push({
                    type: 'websocket-close',
                    event: {
                        streamId: request.id,
                        closeCode: closeEvent.code,
                        closeReason: closeEvent.reason ?? "",
                        timingEvents: timingEvents,
                        tags: []
                    }
                });
            } else {
                // N.b. WebSockets can abort _after_ the response event!
                events.push({ type: 'abort', event: request });
            }
        }

        if (entry._pinned) pinnedIds.push(id);
    });

    if (har.log._tlsErrors) {
        events.push(...har.log._tlsErrors.map((entry) => ({
            type: 'tls-client-error' as const,
            event: {
                failureCause: entry.cause,
                hostname: entry.hostname,
                remoteIpAddress: entry.clientIPAddress,
                remotePort: entry.clientPort,
                tlsMetadata: entry.tlsMetadata ?? {},
                tags: [],
                timingEvents: {
                    startTime: dateFns.parse(entry.startedDateTime).getTime(),
                    connectTimestamp: 0,
                    failureTimestamp: entry.time
                }
            }
        })));
    }

    return { events, pinnedIds };
}

// Mutatively cleans & returns the HAR, to tidy up irrelevant but potentially
// problematic details & ensure we can parse it, if at all possible.
function cleanRawHarData(harContents: any) {
    const entries = harContents?.log?.entries ?? [];

    entries.forEach((entry: any) => {
        // Some HAR exports include invalid serverIPAddresses, which fail validation.
        // Somebody is wrong here, but we don't really care, we never use this data;
        // just drop it entirely instead.
        delete entry.serverIPAddress;

        // FF fails to write headersSize or writes null for req/res that has no headers.
        // We don't use it anyway - set it to -1 if it's missing
        if (entry.request) {
            entry.request.headersSize ??= -1;
            if (entry.request.postData) {
                // Charles sets this to null, but the spec requires a string
                entry.request.postData.mimeType ??= 'application/octet-stream';
            }

            // Cookie data is often messed up (Charles adds extra ""/null pairs, sets bad expires datastring format)
            // and it's optional and we don't use it, so it's better to drop it entirely.
            entry.request.cookies = [];
        }

        // Firefox fails to write timing data for some requests, e.g. requests blocked
        // by adblocker extensions: https://bugzilla.mozilla.org/show_bug.cgi?id=1716335
        if (entry.timings) {
            entry.timings.send ??= -1;
            entry.timings.wait ??= -1;
            entry.timings.receive ??= -1;
        }

        if (entry.response) {
            entry.response.redirectURL ??= ""; // Charles sets this to null, but the spec requires a string
            entry.response.headersSize ??= -1;

            if (entry.response.statusText == null) {
                // Charles omits the status message in some cases
                entry.response.statusText = getStatusMessage(entry.response.status);
            }

            if (entry.response.bodySize === null) {
                // Firefox sometimes sets bodySize to null, even when there is clearly a body being received.
                // Fall back to content-length if available, or use -1 if not.
                // We do want to use this where it's available so this is a bit annoying, but c'est la vie:
                // it's not super important data (just used to compare compression perf) and there's not much
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

            if (entry.response.content) {
                // Similarly, when there's no actual response some fields can be missing. Note that
                // 'content' is response only, but we don't use these fields anyway:
                entry.response.content.size ??= -1;
                entry.response.content.mimeType ??= 'application/octet-stream';
            }

            // Cookie data is often messed up (Charles adds extra ""/null pairs, expires datastring format is often wrong)
            // and it's optional and we don't use it, so it's better to drop it entirely.
            entry.response.cookies = [];
        }

        // We never use the 'cache' field, and it can be annoyingly invalid, so drop it.
        entry.cache = {};
    });

    const pages = harContents?.log?.pages ?? [];
    pages.forEach((page: HarFormat.Page) => {
        // FF doesn't give pages their (required) titles:
        if (page.title === undefined) page.title = page.id;

        // All timings fields are optional, but some sources provide 'null' values (instead of -1)
        // to mark missing data, which isn't valid. Fortunately, we never use this data, so we can
        // just drop it entirely:
        page.pageTimings = {};
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
        matchedRuleId: false,
        protocol: request.url.split(':')[0],
        method: request.method,
        url: request.url,
        path: parsedUrl.pathname,
        hostname: parsedUrl.hostname,
        // We need to promise it has a 'host' header (i.e. the headers are
        // legal for an HTTP request):
        headers: asHtkHeaders(request.headers) as Headers & { host: string },
        rawHeaders: request.headers.map(h => [h.name, h.value]),
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
    if (data?.text) {
        // Prefer raw exported 'text' data, when available
        return stringToBuffer(data.text, 'utf8');
    } else if (data?.params) {
        // If only 'params' is available, stringify and use that.
        return stringToBuffer(
            // Go from array of key-value objects to object of key -> value array:
            querystring.stringify(_(data.params)
                .groupBy(({ name }) => name)
                .mapValues((params) => params.map(p => p.value || ''))
                .valueOf()
            )
        );
    } else {
        return stringToBuffer('');
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
        rawHeaders: response.headers.map(h => [h.name, h.value]),
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
