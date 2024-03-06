import { IObservableValue, observable, action } from 'mobx';

import { testEncodingsAsync } from '../../services/ui-worker-api';
import { ExchangeMessage } from '../../types';

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