import { decodeBody, testEncodingsAsync } from '../workers/worker-api';
import { ExchangeMessage } from '../types';
import { IObservableValue, observable, action } from 'mobx';

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

const DecodedBodyCacheKey = 'bodies-decoded-body';
type DecodedBodyCache = Map<typeof DecodedBodyCacheKey,
    IObservableValue<Buffer | undefined> | undefined
>;

export function getDecodedBody(message: ExchangeMessage): Buffer | undefined {
    const bodyCache = <DecodedBodyCache> message.cache;
    const existingObservable = bodyCache.get(DecodedBodyCacheKey);

    if (existingObservable) return existingObservable.get();
    else {
        const bodyObservable = observable.box<Buffer | undefined>();
        bodyCache.set(DecodedBodyCacheKey, bodyObservable);

        decodeBody(message.body, message.headers['content-encoding'])
        .then(action((decodingResult: Buffer) => {
            bodyObservable.set(decodingResult);
        }))
        // Ignore errors for now - broken encodings etc stay undefined forever
        .catch(() => {});

        // Will be undefined, but ensures we're subscribed to the observable
        return bodyObservable.get();
    }
}

const EncodedSizesCacheKey = 'bodies-encoded-body-test';
type EncodedBodySizes = { [encoding: string]: number };
type EncodedSizesCache = Map<typeof EncodedSizesCacheKey,
    IObservableValue<EncodedBodySizes | undefined> | undefined
>;

export function testEncodings(message: ExchangeMessage): EncodedBodySizes | undefined {
    const realDecoding = getDecodedBody(message);
    if (!realDecoding) return;

    const encodedSizesCache = <EncodedSizesCache> message.cache;
    const existingObservable = encodedSizesCache.get(EncodedSizesCacheKey);

    if (existingObservable) return existingObservable.get();
    else {
        const sizesObservable = observable.box<EncodedBodySizes | undefined>();
        encodedSizesCache.set(EncodedSizesCacheKey, sizesObservable);

        testEncodingsAsync(realDecoding)
        .then(action((testResults: EncodedBodySizes) => {
            sizesObservable.set(testResults)
        }))
        // Ignore errors for now - we just never resolve if testing something unencodable
        .catch(() => {});

        // Will be undefined, but ensures we're subscribed to the observable
        return sizesObservable.get();
    }
}