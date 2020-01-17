export function delay(numberMs: number) {
    return new Promise((resolve) => setTimeout(resolve, numberMs));
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