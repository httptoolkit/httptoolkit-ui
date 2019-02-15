import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as chaiDeepMatch from 'chai-deep-match';
chai.use(chaiAsPromised);
chai.use(chaiDeepMatch);

export const expect = chai.expect;

import { buildBodyReader } from 'mockttp/dist/server/request-utils';
import { Icons } from '../src/icons';
import { HttpExchange } from '../src/types';

export const getExchange = ({
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
} = {}): HttpExchange => ({
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
        source: { ua: '', description: 'Unknown client', icon: Icons.Unknown }
    },
    response: {
        id: '',
        statusCode,
        statusMessage,
        headers: responseHeaders,
        body: buildBodyReader(Buffer.from(responseBody), responseHeaders),
        contentType: 'text'
    },
    searchIndex: '',
    category: 'unknown'
});