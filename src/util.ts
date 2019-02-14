import * as _ from 'lodash';

export function delay(numberMs: number) {
    return new Promise((resolve) => setTimeout(resolve, numberMs));
}

export function getDeferred(): {
    resolve: () => void,
    reject: () => void,
    promise: Promise<void>
} {
    let resolve: undefined | (() => void) = undefined;
    let reject: undefined | (() => void) = undefined;

    let promise = new Promise((resolveCb, rejectCb) => {
        resolve = resolveCb;
        reject = rejectCb;
    });

    // TS thinks we're using these before they're assigned, which is why
    // we need the undefined types, and the any here.
    return { resolve, reject, promise } as any;
}

type Case<R> = [() => boolean, R | undefined];

export function firstMatch<R>(...tests: Array<R | Case<R>>): R | undefined {
    for (let test of tests) {
        if (_.isArray(test) && _.isFunction(test[0])) {
            const [matcher, result] = test;
            if (matcher() && result) return result;
        } else {
            if (test) return <R>test;
        }
    }
}