import * as _ from 'lodash';
import * as React from 'react';
import { IPromiseBasedObservable, fromPromise, PromiseState } from 'mobx-utils';

import { Omit } from './types';
import { observable } from 'mobx';

export function delay(numberMs: number) {
    return new Promise((resolve) => setTimeout(resolve, numberMs));
}

export type Empty = _.Dictionary<undefined>;
export function empty(): Empty {
    return {};
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
    Omit<
        IPromiseBasedObservable<T>,
        'then' | 'catch' | 'value'
    > & {
        value: T | Error | undefined,
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

// Creates an observable promise which doesn't run until somebody tries
// to check the value or wait for it to resolve somehow.
export function lazyObservablePromise<T>(p: () => PromiseLike<T>): ObservablePromise<T> {
    const { resolve: trigger, promise: triggerPromise } = getDeferred();

    const lazyPromise = observablePromise(triggerPromise.then(p));

    ([
        'then',
        'catch',
        'case'
    ] as Array<'then' | 'catch' | 'case'>).forEach((methodName) => {
        const originalMethod = lazyPromise[methodName];
        lazyPromise[methodName] = <any> function (this: ObservablePromise<T>) {
            trigger();
            return originalMethod.apply(this, arguments);
        };
    });

    let value = observable.box<T | Error | undefined>();
    Object.defineProperty(lazyPromise, 'value', {
        get: () => {
            trigger();
            return value.get();
        },
        set: (newValue) => {
            trigger();
            value.set(newValue);
        }
    });

    let state = observable.box<PromiseState>();
    Object.defineProperty(lazyPromise, 'state', {
        get: () => {
            trigger();
            return state.get();
        },
        set: (newState) => {
            trigger();
            state.set(newState);
        }
    });

    return lazyPromise;
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