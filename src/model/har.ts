import * as _ from 'lodash';
import { get } from 'typesafe-get';
import * as HarFormat from 'har-format';

import { asHeaderArray, paramsToEntries } from '../util';

import { HtkRequest } from '../types';

export type Har = HarFormat.Har;
export type HarEntry = HarFormat.Entry;

export function generateHarRequest(request: HtkRequest): HarFormat.Request {
    return {
        method: request.method.toUpperCase(),
        url: request.url,
        httpVersion: "HTTP/1.1", // TODO: Expose this from Mockttp
        cookies: [],
        headers: _.map(request.headers, (headerValue, headerKey) => ({
            name: headerKey,
            value: asHeaderArray(headerValue).join(',')
        })),
        queryString: paramsToEntries(request.parsedUrl.searchParams).map(
            ([paramKey, paramValue]) => ({
                name: paramKey,
                value: paramValue
            })
        ),
        // We only include _short_ bodies in HARs (<1KB)
        postData: request.body.text && request.body.text.length < 1024
            ? {
                mimeType: request.headers['content-type'] || 'application/octet-stream',
                text: request.body.text,
                params: []
            }
            : undefined,
        headersSize: -1,
        bodySize: get(request.body.buffer, 'byteLength') || 0
    };
}