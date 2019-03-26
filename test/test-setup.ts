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
import { buildBodyReader } from 'mockttp/dist/server/request-utils';
import { Icons } from '../src/icons';
import { HttpExchange } from '../src/model/exchange';

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
        method,
        url: `${protocol}://${hostname}${path}${query}`,
        parsedUrl: new URL(`${protocol}://${hostname}${path}${query}`),
        protocol,
        hostname,
        path,
        headers: requestHeaders,
        body: buildBodyReader(Buffer.from(requestBody), requestHeaders),
        contentType: 'text',
        source: { ua: '', summary: 'Unknown client', icon: Icons.Unknown }
    },
    response: {
        id: '',
        statusCode,
        statusMessage,
        headers: responseHeaders,
        body: buildBodyReader(Buffer.from(responseBody), responseHeaders),
        contentType: 'text'
    },
    timingEvents: { startTime: Date.now() },
    searchIndex: '',
    category: 'unknown'
}) as HttpExchange;

export function httpDate(date: Date) {
    const utcDate = dateFns.addMinutes(date, date.getTimezoneOffset());
    return dateFns.format(utcDate, 'ddd, DD MMM YYYY HH:mm:ss [GMT]')
}