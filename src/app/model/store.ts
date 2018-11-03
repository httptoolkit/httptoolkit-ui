import * as _ from 'lodash';

import { observable, action, configure, flow, computed, runInAction } from 'mobx';
import { getLocal, Mockttp } from 'mockttp';

import { CompletedRequest, CompletedResponse } from '../types';
import { parseSource } from './sources';
import { getInterceptors, activateInterceptor } from './htk-client';

import * as amIUsingHtml from '../amiusing.html';

export interface HttpExchange {
    request: CompletedRequest & { parsedUrl: URL };
    response?: CompletedResponse;
};

export interface Interceptor {
    id: string;
    version: string;
    isActivable: string;
    isActive: string;
}

export enum ServerStatus {
    NotStarted,
    Connecting,
    Connected,
    AlreadyInUse,
    UnknownError
}

configure({ enforceActions: 'observed' });

const PROXY_PORT = 8000;

export class Store {

    private server: Mockttp;

    @observable serverStatus: ServerStatus = ServerStatus.NotStarted;
    readonly exchanges = observable.array<HttpExchange>([], { deep: false });

    @computed get activeSources() {
        return _(this.exchanges)
            .map(e => e.request.headers['user-agent'])
            .uniq()
            .map(parseSource)
            .value();
    }

    @observable supportedInterceptors: Interceptor[] | null = null;

    constructor() {
        this.server = getLocal();
    }

    startServer = flow(function * (this: Store) {
        this.serverStatus = ServerStatus.Connecting;

        yield this.refreshInterceptors();

        try {
            yield this.server.start(PROXY_PORT);

            yield this.server.get('http://amiusing.httptoolkit.tech').always().thenReply(200, amIUsingHtml);
            yield this.server.get('https://amiusing.httptoolkit.tech').always().thenReply(200, amIUsingHtml);
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

    async refreshInterceptors() {
        const interceptors = await getInterceptors(PROXY_PORT);

        runInAction(() => {
            this.supportedInterceptors = interceptors;
        });
    }

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

    async activateInterceptor(interceptorId: string) {
        await activateInterceptor(interceptorId, PROXY_PORT);
        await this.refreshInterceptors();
    }

}