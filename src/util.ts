import * as _ from 'lodash';
import * as React from 'react';
import { IPromiseBasedObservable, fromPromise } from 'mobx-utils';

import { Omit } from './types';

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

export type ObservablePromise<T> =
    Omit<IPromiseBasedObservable<T>, 'then' | 'catch'> & {
        then<TResult1 = T, TResult2 = never>(
            onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
            onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
        ): ObservablePromise<TResult1 | TResult2>;
        catch<TResult = never>(
            onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
        ): ObservablePromise<T | TResult>;
    };

export function observablePromise<T>(p: Promise<T>): ObservablePromise<T> {
    const observable = fromPromise(p) as ObservablePromise<T>;

    const originalThen = observable.then;
    observable.then = <any>function (this: ObservablePromise<T>) {
        const result = originalThen.apply(this, arguments);
        return observablePromise(result);
    }

    const originalCatch = observable.catch;
    observable.catch = <any>function (this: ObservablePromise<T>) {
        const result = originalCatch.apply(this, arguments);
        return observablePromise(result);
    }

    return observable;
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

export function isReactElement(node: any): node is React.ReactElement {
    return node && !!node.$$typeof;
}