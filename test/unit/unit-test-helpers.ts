import * as dateFns from 'date-fns';
import { SourceIcons } from '../../src/icons';
import { HttpExchange } from '../../src/model/http/http-exchange';
import { HttpBody } from '../../src/model/http/http-body';
import { FailedTlsConnection } from '../../src/model/tls/failed-tls-connection';
import { AccountStore } from '../../src/model/account/account-store';
import { ProxyStore } from '../../src/model/proxy-store';
import { ApiStore } from '../../src/model/api/api-store';
import { RulesStore } from '../../src/model/rules/rules-store';
import { EventsStore } from '../../src/model/events/events-store';
import { HtkRequest, HtkResponse, TimingEvents } from '../../src/types';

let nextId = 0;

export const getExchangeData = ({
    hostname = 'example.com',
    protocol = 'https:',
    httpVersion = '1.1',
    method = 'GET',
    path = '/',
    query = '',
    requestBody = '' as string | Buffer,
    requestHeaders = {},
    requestTags = [] as string[],
    statusCode = 200,
    statusMessage = '',
    responseBody = '' as string | Buffer,
    responseHeaders = {},
    responseState = 'completed',
    responseTags = [] as string[],
} = {}) => Object.assign(Object.create(HttpExchange.prototype), {
    id: (nextId++).toString(),
    matchedRule: false,
    request: {
        id: '',
        httpVersion: httpVersion,
        method,
        url: `${protocol}//${hostname}${path}${query}`,
        parsedUrl: Object.assign(
            new URL(`${protocol}//${hostname}${path}${query}`),
            { parseable: true }
        ),
        protocol,
        hostname,
        path,
        headers: requestHeaders as { host: string },
        rawHeaders: Object.entries(requestHeaders), // Technically wrong for dupes, but close enough
        body: new HttpBody({
                body: {
                    buffer: Buffer.isBuffer(requestBody)
                        ? requestBody
                        : Buffer.from(requestBody)
                }
            } as any,
            requestHeaders
        ),
        contentType: 'text',
        source: { ua: '', summary: 'Unknown client', icon: SourceIcons.Unknown },
        timingEvents: timingEvents(),
        tags: requestTags,
        cache: new Map() as any
    } as HtkRequest,
    response: responseState === 'aborted'
        ? 'aborted'
    : responseState === 'pending'
        ? undefined
    : {
        id: '',
        statusCode,
        statusMessage,
        headers: responseHeaders,
        rawHeaders: [], // Ignore for now
        body: new HttpBody({
                body: {
                    buffer: Buffer.isBuffer(responseBody)
                        ? responseBody
                        : Buffer.from(responseBody)
                }
            } as any,
            responseHeaders
        ),
        trailers: {},
        rawTrailers: [],
        contentType: 'text',
        timingEvents: timingEvents(),
        tags: responseTags,
        cache: new Map()  as any
    } as HtkResponse,
    timingEvents: { startTime: Date.now() },
    searchIndex: '',
    cache: new Map() as any,
    tags: requestTags.concat(responseTags)
}) as HttpExchange;

export const getFailedTls = ({
    remoteIpAddress = "10.0.0.1",
    failureCause = 'cert-rejected',
    upstreamHostname = "example.com"
} = {}) => Object.assign(Object.create(FailedTlsConnection.prototype), {
    id: (nextId++).toString(),
    remoteIpAddress,
    failureCause,
    upstreamHostname,
    tags: [] as string[]
}) as FailedTlsConnection;

const timingEvents = (): TimingEvents => ({
    startTime: Date.now(),
    startTimestamp: 0
});

export function httpDate(date: Date) {
    const utcDate = dateFns.addMinutes(date, date.getTimezoneOffset());
    return dateFns.format(utcDate, 'ddd, DD MMM YYYY HH:mm:ss [GMT]')
}

// A real events store, unconnected to any server (none of these stores have
// constructor side effects):
export const getEventsStore = () => {
    const accountStore = new AccountStore(() => {});
    const proxyStore = new ProxyStore(accountStore);
    return new EventsStore(
        proxyStore,
        new ApiStore(accountStore),
        new RulesStore(accountStore, proxyStore, () => Promise.reject(new Error('Unused')))
    );
};
