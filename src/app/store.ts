import { createStore, Store } from 'redux';
import { getLocal, Mockttp } from 'mockttp';
import { MockttpRequest } from '../types';

export interface StoreModel {
    server: Mockttp,
    connectedToServer: boolean,
    requests: MockttpRequest[]
}

export type Action =
    { type: 'ConnectedToServer' } |
    { type: 'RequestReceived', request: MockttpRequest };

const reducer = (state: StoreModel, action: Action): StoreModel => {
    switch (action.type) {
        case 'RequestReceived':
            return Object.assign({}, state, { requests: state.requests.concat(action.request) });
        case 'ConnectedToServer':
            return Object.assign({}, state, { connectedToServer: true });
        default:
            return state;
    }
}

export async function getStore(): Promise<Store<StoreModel>> {
    const server = getLocal();

    const store = createStore<StoreModel>(reducer, {
        server: server,
        connectedToServer: false,
        requests: []
    });

    server.start().then(async () => {
        await server.get('/').thenReply(200, 'Running!');
        await server.anyRequest().always().thenPassThrough();

        console.log(`Server started on port ${server.port}`);

        store.dispatch<Action>({
            type: 'ConnectedToServer'
        });

        server.on('request', (req) => store.dispatch<Action>({
            type: 'RequestReceived',
            request: req
        }));
    });

    return store;
}