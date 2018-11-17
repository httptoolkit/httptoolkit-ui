import * as _ from 'lodash';

import { observable, action, configure, flow, computed, runInAction } from 'mobx';
import { getLocal, Mockttp } from 'mockttp';

import { CompletedRequest, CompletedResponse } from '../types';
import { parseSource, TrafficSource } from './sources';
import { getInterceptors, activateInterceptor } from './htk-client';
import { ExchangeCategory, getExchangeCategory } from '../exchange-colors';

import * as amIUsingHtml from '../amiusing.html';

export interface HttpExchange {
    request: CompletedRequest & {
        parsedUrl: URL,
        source: TrafficSource
    };
    response: undefined | 'aborted' | CompletedResponse;
    category: ExchangeCategory;
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

export class Store {

    private server: Mockttp;

    private requestQueue: CompletedRequest[] = [];
    private responseQueue: CompletedResponse[] = [];
    private abortedQueue: CompletedRequest[] = [];

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

        try {
            yield this.server.start();

            yield Promise.all([
                this.server.get(/https?:\/\/amiusing\.httptoolkit\.tech/).always().thenReply(
                    200, amIUsingHtml, { 'content-type': 'text/html' }
                ).then(() =>
                    this.server.anyRequest().always().thenPassThrough()
                ),
                this.refreshInterceptors()
            ]);

            console.log(`Server started on port ${this.server.port}`);

            this.serverStatus = ServerStatus.Connected;

            this.server.on('request', (req) => {
                if (this.requestQueue.length === 0 && this.responseQueue.length === 0) {
                    requestAnimationFrame(this.flushQueuedUpdates);
                }

                this.requestQueue.push(req);
            });
            this.server.on('response', (res) => {
                if (this.requestQueue.length === 0 && this.responseQueue.length === 0) {
                    requestAnimationFrame(this.flushQueuedUpdates);
                }

                this.responseQueue.push(res);
            });
            this.server.on('abort', (req) => {
                if (this.requestQueue.length === 0 && this.responseQueue.length === 0) {
                    requestAnimationFrame(this.flushQueuedUpdates);
                }

                this.abortedQueue.push(req);
            });

            window.addEventListener('beforeunload', () => this.server.stop().catch(() => {}));
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

    @action.bound
    private flushQueuedUpdates() {
        // We batch request updates until here. This runs in a mobx transaction, and
        // on request animation frame, so batches get larger and cheaper if
        // the frame rate starts to drop.

        this.requestQueue.forEach((req) => this.addRequest(req));
        this.requestQueue = [];

        this.responseQueue.forEach((res) => this.setResponse(res));
        this.responseQueue = [];

        this.abortedQueue.forEach((req) => this.markRequestAborted(req));
        this.abortedQueue = [];
    }

    async refreshInterceptors() {
        const interceptors = await getInterceptors(this.server.port);

        runInAction(() => {
            this.supportedInterceptors = interceptors;
        });
    }

    @action
    private addRequest(request: CompletedRequest) {
        const newExchange = {
            request: Object.assign(request, {
                parsedUrl: new URL(request.url, `${request.protocol}://${request.hostname}`),
                source: parseSource(request.headers['user-agent'])
            }),
            response: undefined
        };

        const exchangeWithCategory = Object.assign(newExchange, {
            category: <ExchangeCategory> getExchangeCategory(newExchange)
        });

        this.exchanges.push(observable.object(exchangeWithCategory, {}, { deep: false }));
    }

    @action
    private markRequestAborted(request: CompletedRequest) {
        const exchange = _.find(this.exchanges, (exchange) => exchange.request.id === request.id)!;

        // Shouldn't happen in general, but possible in some very rare cases
        if (!exchange) return;

        exchange.response = 'aborted';
    }

    @action
    private setResponse(response: CompletedResponse) {
        const exchange = _.find(this.exchanges, (exchange) => exchange.request.id === response.id)!;

        // Shouldn't happen in general, but possible in some very rare cases
        if (!exchange) return;

        exchange.response = response;
        exchange.category = getExchangeCategory(exchange);
    }

    @action.bound
    clearExchanges() {
        this.exchanges.clear();
    }

    async activateInterceptor(interceptorId: string) {
        await activateInterceptor(interceptorId, this.server.port);
        await this.refreshInterceptors();
    }

}