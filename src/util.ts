import * as _ from 'lodash';
import * as React from 'react';
import { IPromiseBasedObservable, fromPromise, PromiseState } from 'mobx-utils';

import { Omit } from './types';
import { observable } from 'mobx';
import { desktopVersion } from './services/service-versions';

export function delay(numberMs: number) {
    return new Promise((resolve) => setTimeout(resolve, numberMs));
}

export type Empty = _.Dictionary<undefined>;
export function empty(): Empty {
    return {};
}

export function attempt<T>(fn: () => T): Promise<T> {
    try {
        const result = fn();
        return Promise.resolve(result);
    } catch (e) {
        return Promise.reject(e);
    }
}

export interface Deferred<T> {
    resolve: (arg: T) => void,
    reject: (e?: Error) => void,
    promise: Promise<T>
}

export function getDeferred<T = void>(): Deferred<T> {
    let resolve: undefined | ((arg: T) => void) = undefined;
    let reject: undefined | ((e?: Error) => void) = undefined;

    let promise = new Promise<T>((resolveCb, rejectCb) => {
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

export function saveFile(filename: string, mimeType: string, content: string): void {
    const element = document.createElement('a');

    const data = new Blob([content], {type: 'application/har+json'});

    const objectUrl = window.URL.createObjectURL(data);
    element.setAttribute('href', objectUrl);
    element.setAttribute('download', filename);

    element.style.display = 'none';

    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    // Stop persisting the data. In theory we could do this immediately, as the spec says
    // existing requests will be fine, but let's wait a few seconds to make sure the
    // request has definitely fired properly:
    setTimeout(() => window.URL.revokeObjectURL(objectUrl), 10000);
}

type FileReaderType = 'text' | 'arraybuffer' | 'path';

// Ask the user for a file of one of the given types, and get the raw arraybuffer data
export function uploadFile(type: 'arraybuffer', acceptedMimeTypes?: string[]): Promise<ArrayBuffer | null>
// Ask the user for a file of one of the given types, and get the utf8 text data
export function uploadFile(type: 'text', acceptedMimeTypes?: string[]): Promise<string | null>;
// Ask the user for a file of one of the given types, and get the file path itself (electron only)
export function uploadFile(type: 'path', acceptedMimeTypes?: string[]): Promise<string | null>;
export function uploadFile(
    type: FileReaderType = 'arraybuffer',
    acceptedMimeTypes: string[] = []
): Promise<ArrayBuffer | string | null> {
    if (type === 'path' && !desktopVersion.value) {
        throw new Error("Path inputs can only be used from Electron");
    }

    const fileInput = document.createElement('input');
    fileInput.setAttribute('type', 'file');
    if (acceptedMimeTypes.length > 0) {
        fileInput.setAttribute('accept', acceptedMimeTypes.join(','));
    }

    const result = getDeferred<ArrayBuffer | string | null>();

    fileInput.addEventListener('change', () => {
        if (!fileInput.files || !fileInput.files.length) {
            return Promise.resolve(null);
        }

        const file = fileInput.files[0];

        if (type === 'path') {
            // file.path is an Electron-only extra property:
            // https://github.com/electron/electron/blob/master/docs/api/file-object.md
            result.resolve((file as unknown as { path: string }).path);
        } else {
            const fileReader = new FileReader();

            fileReader.addEventListener('load', () => {
                result.resolve(fileReader.result);
            });

            fileReader.addEventListener('error', (error: any) => {
                result.reject(error);
            });

            if (type === 'text') {
                fileReader.readAsText(file);
            } else {
                fileReader.readAsArrayBuffer(file);
            }
        }
    });

    fileInput.click();

    // Hack to avoid unexpected GC of file inputs, so far as possible.
    // See similar issue at https://stackoverflow.com/questions/52103269.
    // Can't use answer there, as we can't reliably detect 'cancel'.
    // Hold a reference until we get the data or 10 minutes passes (for cancel)
    Promise.race([result.promise, delay(1000 * 60 * 10)])
        .catch(() => {})
        .then(() => fileInput.remove());

    return result.promise;
}