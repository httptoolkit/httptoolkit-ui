import * as dateFns from 'date-fns';
import { SourceIcons } from '../../src/icons';
import { HttpExchange, HttpBody } from '../../src/model/http/exchange';
import { FailedTLSConnection } from '../../src/model/events/failed-tls-connection';
import { HtkRequest, HtkResponse } from '../../src/types';

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
    id: '',
    matchedRuleId: '?',
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
        rawHeaders: [], // Ignore for now
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
        timingEvents: { startTime: Date.now() },
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
        contentType: 'text',
        timingEvents: { startTime: Date.now() },
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
    failureCause = 'cert-rejected'
} = {}) => Object.assign(Object.create(FailedTLSConnection.prototype), {
    remoteIpAddress,
    failureCause,
    tags: [] as string[]
}) as FailedTLSConnection;

export function httpDate(date: Date) {
    const utcDate = dateFns.addMinutes(date, date.getTimezoneOffset());
    return dateFns.format(utcDate, 'ddd, DD MMM YYYY HH:mm:ss [GMT]')
}