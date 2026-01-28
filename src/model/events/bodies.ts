import { IObservableValue, observable, action } from 'mobx';

import { testEncodingsAsync } from '../../services/ui-worker-api';
import { ExchangeMessage } from '../../types';
import { ObservableCache } from '../observable-cache';

const EncodedSizesCacheKey = Symbol('encoded-body-test');
type EncodedBodySizes = { [encoding: string]: number };
type EncodedSizesCache = ObservableCache<{
    [EncodedSizesCacheKey]: IObservableValue<EncodedBodySizes | undefined> | undefined
}>;

export function testEncodings(message: ExchangeMessage): EncodedBodySizes | undefined {
    if (!message.body.isDecoded()) return;

    const encodedSizesCache = <EncodedSizesCache> message.cache;
    const existingObservable = encodedSizesCache.get(EncodedSizesCacheKey);

    if (existingObservable) return existingObservable.get();
    else {
        const sizesObservable = observable.box<EncodedBodySizes | undefined>();
        encodedSizesCache.set(EncodedSizesCacheKey, sizesObservable);

        testEncodingsAsync(message.body.decodedData)
        .then(action((testResults: EncodedBodySizes) => {
            sizesObservable.set(testResults)
        }))
        // Ignore errors for now - we just never resolve if testing something unencodable
        .catch(() => {});

        // Will be undefined, but ensures we're subscribed to the observable
        return sizesObservable.get();
    }
}

export function decodingRequired(encodedBuffer: Buffer, encodings: string[]): boolean {
    return !(
        encodings.length === 0 || // No encoding
        (encodings.length === 1 && encodings[0] === 'identity') || // No-op only encoding
        encodedBuffer.length === 0 // Empty body (e.g. HEAD, 204, etc)
    );
}