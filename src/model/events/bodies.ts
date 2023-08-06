import { IObservableValue, observable, action } from 'mobx';

import { testEncodingsAsync } from '../../services/ui-worker-api';
import { ExchangeMessage } from '../../types';

export function getReadableSize(bytes: number, siUnits = true) {
    let thresh = siUnits ? 1000 : 1024;

    let units = siUnits
        ? ['bytes', 'kB','MB','GB','TB','PB','EB','ZB','YB']
        : ['bytes', 'KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];

    let unitIndex = bytes === 0 ? 0 :
        Math.floor(Math.log(bytes) / Math.log(thresh));

    let unitName = bytes === 1 ? 'byte' : units[unitIndex];

    return (bytes / Math.pow(thresh, unitIndex)).toFixed(1).replace(/\.0$/, '') + ' ' + unitName;
}

function sigFig(num: number, figs: number): number {
    return parseFloat(num.toFixed(figs));
}

export function getReadableDuration(durationMs: number): string {
    return (durationMs < 100) ? (sigFig(durationMs, 2) + 'ms') // 22.34ms
        : (durationMs < 1000 ? sigFig(durationMs, 1) + 'ms' // 999.5ms
            : (durationMs < 10000 ? sigFig(durationMs / 1000, 3) + ' s' // 3.045 seconds
                : sigFig(durationMs / 1000, 1) + ' s')) // 11.2 seconds
}

const EncodedSizesCacheKey = Symbol('encoded-body-test');
type EncodedBodySizes = { [encoding: string]: number };
type EncodedSizesCache = Map<typeof EncodedSizesCacheKey,
    IObservableValue<EncodedBodySizes | undefined> | undefined
>;

export function testEncodings(message: ExchangeMessage): EncodedBodySizes | undefined {
    if (!message.body.decoded) return;

    const encodedSizesCache = <EncodedSizesCache> message.cache;
    const existingObservable = encodedSizesCache.get(EncodedSizesCacheKey);

    if (existingObservable) return existingObservable.get();
    else {
        const sizesObservable = observable.box<EncodedBodySizes | undefined>();
        encodedSizesCache.set(EncodedSizesCacheKey, sizesObservable);

        testEncodingsAsync(message.body.decoded)
        .then(action((testResults: EncodedBodySizes) => {
            sizesObservable.set(testResults)
        }))
        // Ignore errors for now - we just never resolve if testing something unencodable
        .catch(() => {});

        // Will be undefined, but ensures we're subscribed to the observable
        return sizesObservable.get();
    }
}
