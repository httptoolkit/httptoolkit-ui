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

export function typeCheck<T extends string>(types: readonly T[]) {
    return (type: string): type is T => types.includes(type as T);
}

export function longestPrefix(baseString: string, ...strings: string[]) {
    let prefix = "";
    const shortestLength = Math.min(
        baseString.length,
        ...strings.map(s => s.length)
    );

    for (let i = 0; i < shortestLength; i++) {
        const char = baseString[i];
        if (!strings.every(s => s[i] === char)) break;
        prefix += char;
    }

    return prefix;
}

export function tryParseJson(input: string): object | undefined {
    try {
        return JSON.parse(input);
    } catch (e) {
        return undefined;
    }
}

export function recursiveMapValues(
    input: unknown,
    fn: (value: unknown, key?: string) => unknown,
    key: string | undefined = undefined
): unknown {
    if (_.isArray(input)) {
        return input.map((innerObj) => recursiveMapValues(innerObj, fn));
    } else if (_.isPlainObject(input)) {
        return _.mapValues(input as {}, (val, key) => recursiveMapValues(val, fn, key));
    } else {
        return fn(input, key);
    }
}