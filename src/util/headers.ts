import * as _ from 'lodash';
import { Headers } from '../types';

// Based RFC7230, 3.2.6:
export const HEADER_NAME_PATTERN = '^[!#$%&\'*+\\-.^_`\\|~A-Za-z0-9]+$';
    // The \\| is required here because in 'v' flag regexes (used in HTML patterns by default) the |
    // character seems to be disallowed unescaped in classes like this.
export const HEADER_NAME_REGEX = new RegExp(HEADER_NAME_PATTERN);

// This fairly meaningless override combo seems to be
// required to make it ok to use this when T = X | undefined.
export function lastHeader<T>(val: T | T[]): T;
export function lastHeader<T>(val: T | T[] | undefined): T | undefined;
export function lastHeader<T>(val: T | T[] | undefined): T | undefined {
    if (Array.isArray(val)) return val[val.length - 1];
    else return val;
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

type FlatHeaders = { [key: string]: string };

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