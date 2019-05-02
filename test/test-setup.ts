import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as chaiDeepMatch from 'chai-deep-match';
import * as chaiEnzyme from 'chai-enzyme';
chai.use(chaiAsPromised);
chai.use(chaiDeepMatch);
chai.use(chaiEnzyme());

import Enzyme from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

if (Enzyme) {
    // Not defined in node-based (e.g. integration) tests
    Enzyme.configure({ adapter: new Adapter() });
}

export const expect = chai.expect;

import * as dateFns from 'date-fns';
import { Icons } from '../src/icons';
import { HttpExchange, ExchangeBody } from '../src/model/exchange';
import { HtkRequest, HtkResponse } from '../src/types';

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
        source: { ua: '', summary: 'Unknown client', icon: Icons.Unknown },
        timingEvents: { startTime: Date.now() },
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