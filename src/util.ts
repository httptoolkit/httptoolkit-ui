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