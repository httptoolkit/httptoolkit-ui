import { observable, createAtom, IAtom, computed, IComputedValueOptions, IComputedValue } from 'mobx';
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

export function isObservablePromise<T>(p: any): p is ObservablePromise<T> {
    return typeof p === 'object' &&
        'then' in p &&
        'catch' in p &&
        'case' in p &&
        'value' in p &&
        'state' in p;
}

export interface ObservableDeferred<T> {
    resolve: (arg: T) => void,
    reject: (e?: Error) => void,
    promise: ObservablePromise<T>
}

export function getObservableDeferred<T = void>(): ObservableDeferred<T> {
    let resolve: undefined | ((arg: T) => void) = undefined;
    let reject: undefined | ((e?: Error) => void) = undefined;

    const promise = observablePromise(new Promise<T>((resolveCb, rejectCb) => {
        resolve = resolveCb;
        reject = rejectCb;
    }));

    // TS thinks we're using these before they're assigned, which is why
    // we need the undefined types, and the any here.
    return { resolve, reject, promise } as any;
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

function debounced<T>(fn: () => T, timeoutMs: number): () => T {
    let cachedValue: { value: T, atom: IAtom } | undefined;

    return function (this: any) {
        if (cachedValue) {
            cachedValue.atom.reportObserved();
        } else {
            // Calculate and cache the result:
            cachedValue = {
                value: fn.apply(this),
                atom: createAtom("DebounceAtom")
            };

            // Batch subsequent runs for the next timeoutMs:
            setTimeout(() => {
                const { atom } = cachedValue!;
                cachedValue = undefined;
                atom.reportChanged(); // Ping subscribers to update
            }, timeoutMs);
        }
        return cachedValue.value;
    }
}

export function debounceComputed<T>(timeoutMs: number, computedOptions?: IComputedValueOptions<T>): MethodDecorator;
export function debounceComputed<T>(callback: () => T, timeoutMs: number, computedOptions?: IComputedValueOptions<T>): IComputedValue<T>;
export function debounceComputed<T>(
    cbOrTimeout: number | (() => T),
    optionsOrTimeout?: IComputedValueOptions<T> | number,
    maybeOptions?: IComputedValueOptions<T>
): MethodDecorator | IComputedValue<T> {
    let fn: () => T;
    let timeoutMs: number;
    let computedOptions: IComputedValueOptions<T>;

    if (typeof cbOrTimeout === 'number') {
        timeoutMs = cbOrTimeout;
        computedOptions = (optionsOrTimeout as IComputedValueOptions<T>) ?? {};

        return <T>(target: any, key: string | symbol, descriptor: TypedPropertyDescriptor<T>): void => {
            if (!descriptor.get) throw new Error('debounceComputed requires a getter');
            return computed(computedOptions)(target, key, {
                ...descriptor,
                get: debounced(descriptor.get, timeoutMs)
            });
        };
    } else {
        fn = cbOrTimeout;
        timeoutMs = optionsOrTimeout as number;
        computedOptions = maybeOptions ?? {};

        return computed(debounced(fn, timeoutMs), computedOptions);
    }
}

// An observable clock, allowing for time-reactive logic & UI, but ticking only while
// observed, so no intervals etc are required any time it isn't in active use. Closely
// based on the example in https://mobx.js.org/custom-observables.html.
class Clock {

    private atom: IAtom = createAtom(
        "Clock",
        () => this.startTicking(),
        () => this.stopTicking()
    );

    private intervalHandler: ReturnType<typeof setInterval> | null = null;
    private currentDateTime: number = Date.now();

    getTime() {
        if (this.atom.reportObserved()) {
            return this.currentDateTime;
        } else {
            return Date.now();
        }
    }

    tick() {
        this.currentDateTime = Date.now();
        this.atom.reportChanged();
    }

    startTicking() {
        this.tick();
        this.intervalHandler = setInterval(() => this.tick(), 50);
    }

    stopTicking() {
        if (this.intervalHandler == null) return;

        clearInterval(this.intervalHandler);
        this.intervalHandler = null;
    }

}

export const observableClock = new Clock();