import * as _ from 'lodash';

// Before imports to avoid circular import with server-api
export const RUNNING_IN_WORKER = typeof window === 'undefined';

export type Empty = _.Dictionary<undefined>;
export function empty(): Empty {
    return {};
}

type Case<R> = [() => boolean, R | undefined];

export function firstMatch<R>(...tests: Array<Case<R> | R | undefined>): R | undefined {
    for (let test of tests) {
        if (_.isArray(test) && _.isFunction(test[0])) {
            const [matcher, result] = test;
            if (matcher() && result) return result;
        } else {
            if (test) return <R>test;
        }
    }
}

// This fairly meaningless override combo seems to be
// required to make it ok to use this when T = X | undefined.
export function lastHeader<T>(val: T | T[]): T;
export function lastHeader<T>(val: T | T[] | undefined): T | undefined;
export function lastHeader<T>(val: T | T[] | undefined): T | undefined {
    if (_.isArray(val)) return val[val.length - 1];
    else return val;
}

export function asHeaderArray(val: string | string[] | undefined, sep = ','): string[] {
    if (_.isArray(val)) {
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

export function joinAnd(val: string[], initialSep = ', ', finalSep = ' and ') {
    if (val.length === 1) return val[0];

    return val.slice(0, -1).join(initialSep) + finalSep + val[val.length - 1];
}

// In some places, we need a Buffer in theory, but we know for sure that it'll never
// be read, we just need to know its size (e.g. calculating compression stats).
// For those cases, it can be useful to *carefully* provide this fake buffer instead.
// Could actually allocate an empty buffer, but that's much more expensive if the
// buffer is large, and probably a waste.
export function fakeBuffer(byteLength: number): FakeBuffer {
    return { byteLength: byteLength };
}
export type FakeBuffer = { byteLength: number };
