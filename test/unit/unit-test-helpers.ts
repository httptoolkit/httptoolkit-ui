import * as dateFns from 'date-fns';
import { SourceIcons } from '../../src/icons';
import { HttpExchange, ExchangeBody } from '../../src/model/http/exchange';
import { FailedTlsRequest, HtkRequest, HtkResponse } from '../../src/types';

export const getExchangeData = ({
    hostname = 'example.com',
    protocol = 'https:',
    httpVersion = '1.1',
    method = 'GET',
    path = '/',
    query = '',
    requestBody = '',
    requestHeaders = {},
    statusCode = 200,
    statusMessage = '',
    responseBody = '',
    responseHeaders = {},
    responseState = 'completed'
} = {}) => Object.assign(Object.create(HttpExchange.prototype), {
    id: '',
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
        body: new ExchangeBody(
            { body: { buffer: Buffer.from(requestBody) } } as any,
            requestHeaders
        ),
        contentType: 'text',
        source: { ua: '', summary: 'Unknown client', icon: SourceIcons.Unknown },
        timingEvents: { startTime: Date.now() },
        tags: [],
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
        body: new ExchangeBody(
            { body: { buffer: Buffer.from(responseBody) } } as any,
            responseHeaders
        ),
        contentType: 'text',
        timingEvents: { startTime: Date.now() },
        tags: [],
        cache: new Map()  as any
    } as HtkResponse,
    timingEvents: { startTime: Date.now() },
    searchIndex: '',
    category: 'unknown',
    cache: new Map() as any,
    tags: []
}) as HttpExchange;

export const getFailedTls = ({
    remoteIpAddress = "10.0.0.1",
    failureCause = 'cert-rejected'
} = {}) => ({
    remoteIpAddress,
    failureCause,
    tags: [] as string[]
}) as FailedTlsRequest;

export function httpDate(date: Date) {
    const utcDate = dateFns.addMinutes(date, date.getTimezoneOffset());
    return dateFns.format(utcDate, 'ddd, DD MMM YYYY HH:mm:ss [GMT]')
}