import * as dateFns from 'date-fns';
import { SourceIcons } from '../../src/icons';
import { HttpExchange, ExchangeBody } from '../../src/model/http/exchange';
import { HtkRequest, HtkResponse } from '../../src/types';

export const getExchangeData = ({
    hostname = 'example.com',
    protocol = 'https',
    method = 'GET',
    path = '/',
    query = '',
    requestBody = '',
    requestHeaders = {},
    statusCode = 200,
    statusMessage = '',
    responseBody = '',
    responseHeaders = {}
} = {}) => ({
    id: '',
    request: {
        id: '',
        httpVersion: '1.1',
        method,
        url: `${protocol}://${hostname}${path}${query}`,
        parsedUrl: new URL(`${protocol}://${hostname}${path}${query}`),
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
    response: {
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
    cache: new Map() as any
}) as HttpExchange;

export function httpDate(date: Date) {
    const utcDate = dateFns.addMinutes(date, date.getTimezoneOffset());
    return dateFns.format(utcDate, 'ddd, DD MMM YYYY HH:mm:ss [GMT]')
}