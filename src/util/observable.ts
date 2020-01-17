import { observable } from 'mobx';
import { IPromiseBasedObservable, fromPromise, PromiseState } from 'mobx-utils';

import { Omit } from '../types';
import { getDeferred } from './promise';

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

export function observablePromise<T>(p: Promise<T> |  ObservablePromise<T>): ObservablePromise<T> {
    const observable = fromPromise(p) as ObservablePromise<T>;

    const originalThen = observable.then;
    observable.then = function (this: ObservablePromise<T>): any {
        const result = originalThen.apply(this, arguments as any);
        return observablePromise(result);
    }

    const originalCatch = observable.catch;
    observable.catch = <any>function (this: ObservablePromise<T>) {
        const result = originalCatch.apply(this, arguments as any);
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
        const originalMethod = lazyPromise[methodName] as Function;
        lazyPromise[methodName] = function (this: ObservablePromise<T>): any {
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