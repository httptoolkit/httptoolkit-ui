import * as _ from 'lodash';
import * as path from 'path';
import { observable, action, configure, flow } from 'mobx';
import { getLocal, Mockttp } from 'mockttp';

import { CompletedRequest, CompletedResponse } from '../types';

export type HttpExchange = {
    request: CompletedRequest & { parsedUrl: URL };
    response?: CompletedResponse;
};

export enum ServerStatus {
    NotStarted,
    Connecting,
    Connected,
    AlreadyInUse,
    UnknownError
}

configure({ enforceActions: 'observed' });

export class Store {

    private server: Mockttp;

    @observable serverStatus: ServerStatus = ServerStatus.NotStarted;
    exchanges = observable.array<HttpExchange>([], { deep: false });

    constructor(options: { https: boolean, configRoot: string }) {
        this.server = getLocal({
            https: options.https ? {
                keyPath: path.join(options.configRoot, 'ca.key'),
                certPath: path.join(options.configRoot, 'ca.pem')
            }: undefined,
            cors: false
        });
    }

    startServer = flow(function * (this: Store) {
        this.serverStatus = ServerStatus.Connecting;

        try {
            yield this.server.start(8000);
            yield this.server.anyRequest().always().thenPassThrough();

            console.log(`Server started on port ${this.server.port}`);

            this.serverStatus = ServerStatus.Connected;

            this.server.on('request', (req) => this.addRequest(req));
            this.server.on('response', (res) => this.setResponse(res));

            window.addEventListener('beforeunload', () => this.server.stop());
        } catch (err) {
            if (err.response && err.response.status === 409) {
                console.info('Server already in use');
                this.serverStatus = ServerStatus.AlreadyInUse;
            } else {
                console.error(err);
                this.serverStatus = ServerStatus.UnknownError;
            }
        }
    });

    @action
    private addRequest(request: CompletedRequest) {
        const newExchange = observable.object({
            request: Object.assign(request, {
                parsedUrl: new URL(request.url, `${request.protocol}://${request.hostname}`)
            }),
            response: undefined
        }, {}, { deep: false });

        this.exchanges.push(newExchange);
    }

    @action
    private setResponse(response: CompletedResponse) {
        const exchange = _.find(this.exchanges, (exchange) => exchange.request.id === response.id)!;
        exchange.response = response;
    }

    @action.bound
    clearExchanges() {
        this.exchanges.clear();
    }

}