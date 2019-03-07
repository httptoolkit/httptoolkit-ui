
import { decodeContent } from '../workers/worker-api';
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
        const bodyObservable = observable.box<Buffer | undefined>(undefined);
        bodyCache.set(DecodedBodyCacheKey, bodyObservable);

        decodeContent(message.body.buffer, message.headers['content-encoding'])
        .then(action<(result: Buffer) => void>((decodingResult) => {
            bodyObservable.set(decodingResult);
        }))
        // Ignore errors for now - broken encodings etc stay undefined forever
        .catch(() => {});

        // Will be undefined, but ensures we're subscribed to the observable
        return bodyObservable.get();
    }
}