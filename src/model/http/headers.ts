import * as _ from 'lodash';
import { Headers, RawHeaders } from '../../types';

export {
    h2HeadersToH1
} from 'mockttp/dist/util/header-utils';

// Based RFC7230, 3.2.6:
export const HEADER_NAME_PATTERN = '^[!#$%&\'*+\\-.^_`\\|~A-Za-z0-9]+$';
    // The \\| is required here because in 'v' flag regexes (used in HTML patterns by default) the |
    // character seems to be disallowed unescaped in classes like this.
export const HEADER_NAME_REGEX = new RegExp(HEADER_NAME_PATTERN);

// Conversion between headers (map of key to string or string array, used in lots of older/simpler APIs)
// and raw headers (array of [string, string] pairs, full representation of header reality).

export const headersToRawHeaders = (headers: Headers): RawHeaders =>
    Object.entries(headers || {}).reduce(
        (acc: RawHeaders, [key, value]) => {
            if (Array.isArray(value)) {
                acc = acc.concat(value.map(value => [ key, value ]))
            } else {
                acc.push([ key, value || '' ]);
            }
            return acc;
        }, []
    );

export const rawHeadersToHeaders = (headers: RawHeaders): Headers =>
    headers.reduce((headersObj: { [k: string]: string | string[] }, [key, value]) => {
        const headerName = key.toLowerCase();

        const existingValue = headersObj[headerName];
        if (existingValue === undefined) {
            headersObj[headerName] = value;
        } else if (typeof existingValue === 'string') {
            headersObj[headerName] = [existingValue, value];
        } else {
            existingValue.push(value);
        }
        return headersObj;
    }, {});

export const withoutPseudoHeaders = (headers: RawHeaders): RawHeaders =>
    headers.filter(([key]) => !key.startsWith(':'));

/**
 * Get the header value for the given header key. Case insensitive. If there are multiple values,
 * this will return the last value. If there are no values or the headers themselves aren't defined,
 * this returns undefined.
 */
export function getHeaderValue(
    headers: Headers | RawHeaders | undefined,
    headerKey: Lowercase<string>
): string | undefined {
    if (Array.isArray(headers)) {
        const headerPair = _.findLast(headers, ([key]) => key.toLowerCase() === headerKey);
        return headerPair?.[1];
    } else {
        const headerValue = headers?.[headerKey];

        if (Array.isArray(headerValue)) {
            return headerValue[headerValue.length - 1];
        } else {
            return headerValue;
        }
    }
}

/**
 * Get all header values for the given header key. Case insensitive.
 * If there are no values this returns an empty list.
 */
export const getHeaderValues = (headers: Headers | RawHeaders, headerKey: string): string[] => {
    if (Array.isArray(headers)) {
        headerKey = headerKey.toLowerCase();
        return headers.filter(([key]) => key.toLowerCase() === headerKey).map(([_, value]) => value);
    } else {
        const headerValue = headers[headerKey];

        if (Array.isArray(headerValue)) {
            return headerValue;
        } else if (headerValue !== undefined) {
            return [headerValue];
        } else {
            return [];
        }
    }
}

/**
 * Set the value of a given header, overwriting it if present or otherwise adding it as a new header.
 *
 * For header objects, this overwrites all values. For raw headers, this overwrites the last value, so
 * if multiple values are present others may remain. In general you probably don't want to use this
 * for headers that could legally have multiple values present.
 */
export const setHeaderValue = (
    headers: Headers | RawHeaders,
    headerKey: string,
    headerValue: string,
    options: { prepend?: true } = {}
) => {
    const lowercaseHeaderKey = headerKey.toLowerCase();

    if (Array.isArray(headers)) {
        const headerPair = _.findLast(headers, ([key]) => key.toLowerCase() === lowercaseHeaderKey);
        if (headerPair) {
            headerPair[1] = headerValue;
        } else {
            if (options.prepend) headers.unshift([headerKey, headerValue]);
            else headers.push([headerKey, headerValue]);
        }
    } else {
        const existingKey = Object.keys(headers).find(k => k.toLowerCase() === lowercaseHeaderKey);
        headers[existingKey || headerKey] = headerValue;
    }
}

/**
 * Clear the value of a given header, or do nothing if not present.
 *
 * For header objects, this clears all values. For raw headers, this clears the last value, so if
 * multiple values are present others may remain. In general you probably don't want to use this
 * for headers that could legally have multiple values present.
 */
export const removeHeader = (headers: Headers | RawHeaders, headerKey: string) => {
    const lowercaseHeaderKey = headerKey.toLowerCase();

    if (Array.isArray(headers)) {
        const headerIndex = _.findLastIndex(headers, ([key]) => key.toLowerCase() === lowercaseHeaderKey);
        if (headerIndex !== -1) headers.splice(headerIndex, 1);
    } else {
        const existingKey = Object.keys(headers).find(k => k.toLowerCase() === lowercaseHeaderKey);
        delete headers[existingKey || headerKey];
    }
}

/**
 * Returns a clone of the header input, with the value of the given headers set, overwriting values if
 * present or otherwise adding it as a new header (but not mutating the input itself).
 *
 * For header objects, this overwrites all values. For raw headers, this overwrites the first value, so
 * if multiple values are present others may remain. In general you probably don't want to use this
 * for headers that could legally have multiple values present.
 */
export const withHeaderValue = <T extends Headers | RawHeaders>(headers: T, headerAdditions: Record<string, string>): T => {
    headers = _.cloneDeep(headers);
    Object.entries(headerAdditions).forEach(([key, value]) =>
        setHeaderValue(headers, key, value)
    );
    return headers;
}

export function asHeaderArray(val: string | string[] | undefined, sep = ','): string[] {
    if (Array.isArray(val)) {
        // Split individual values, as multiple headers can still have multiple values
        return _.flatMap(val, header =>
            header.split(sep).map(value => value.trim())
        );
    } else if (!val) {
        return [];
    } else {
        return val.split(sep).map(value => value.trim());
    }
}

export type FlatHeaders = { [key: string]: string };

/**
 * Flatten headers, i.e. combine any duplicates into comma-separated values. Required for some APIs
 * that don't accept duplicate headers.
 */
export function headersToFlatHeaders(headers: Headers): FlatHeaders {
    return _.mapValues(
        _.pickBy(headers, (key, value) => key && value),
        (value) =>
            _.isArray(value)
                ? value.join(', ')
                : value! // We know this is set because of filter above
    );
}