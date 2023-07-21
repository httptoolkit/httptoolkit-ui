import { observable } from 'mobx';

import { lazyObservablePromise } from '../../util/observable';
import { persist, hydrate } from '../../util/mobx-persist/persist';
import { RequestInput, requestInputSchema } from './send-data-model';

export class SendStore {

    readonly initialized = lazyObservablePromise(async () => {
        await hydrate({
            key: 'send-store',
            store: this
        });

        console.log('Send store initialized');
    });

    @persist('object', requestInputSchema) @observable
    requestInput: RequestInput = {
        url: '',
        method: 'GET',
        headers: [],
        requestContentType: 'text',
        rawBody: Buffer.from([])
    };

}
