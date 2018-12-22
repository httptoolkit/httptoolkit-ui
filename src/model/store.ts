import * as _ from 'lodash';

import { observable, action, configure, flow, computed, runInAction } from 'mobx';
import { getLocal, Mockttp, CompletedRequest, CompletedResponse } from 'mockttp';

import { HttpExchange } from '../types';
import { parseSource } from './sources';
import { getInterceptors, activateInterceptor, getConfig } from './htk-client';
import { ExchangeCategory, getExchangeCategory } from '../exchange-colors';

import * as amIUsingHtml from '../amiusing.html';
import { getHTKContentType } from '../content-types';
import { Interceptor, getInterceptOptions } from './interceptors';


export enum ServerStatus {
    NotStarted,
    Connecting,
    Connected,
    AlreadyInUse,
    UnknownError
}

configure({ enforceActions: 'observed' });

export class Store {

    @observable.ref
    private server: Mockttp;

    @observable
    certPath: string | undefined;

    @computed get serverPort() {
        if (this.server) {
            return this.server.port;
        } else {
            return undefined;
        }
    }

    // TODO: Combine into a batchedEvent queue of callbacks
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

    @observable interceptors: _.Dictionary<Interceptor>;

    constructor() {
        this.server = getLocal();
        this.interceptors = getInterceptOptions([]);
    }

    startServer = flow(function * (this: Store) {
        this.serverStatus = ServerStatus.Connecting;

        try {
            yield this.server.start();

            yield Promise.all([
                this.server.get(/^https?:\/\/amiusing\.httptoolkit\.tech$/).always().thenReply(
                    200, amIUsingHtml, { 'content-type': 'text/html' }
                ).then(() =>
                    this.server.anyRequest().always().thenPassThrough()
                ),
                this.refreshInterceptors(),
                getConfig().then((config) => {
                    this.certPath = config.certificatePath
                })
            ]);

            setInterval(() => this.refreshInterceptors(), 10000);

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
        const serverInterceptors = await getInterceptors(this.server.port);

        runInAction(() => {
            this.interceptors = getInterceptOptions(serverInterceptors);
        });
    }

    @action
    private addRequest(request: CompletedRequest) {
        const newExchange = {
            id: request.id,
            request: Object.assign(request, {
                parsedUrl: new URL(request.url, `${request.protocol}://${request.hostname}`),
                source: parseSource(request.headers['user-agent']),
                contentType: getHTKContentType(request.headers['content-type'])
            }),
            response: undefined,
            searchIndex: observable.array(
                [request.url]
                .concat(..._.map(request.headers, (value, key) => `${key}: ${value}`))
            )
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
        exchange.searchIndex.push('aborted');
    }

    @action
    private setResponse(response: CompletedResponse) {
        const exchange = _.find(this.exchanges, (exchange) => exchange.request.id === response.id)!;

        // Shouldn't happen in general, but possible in some very rare cases
        if (!exchange) return;

        exchange.response = Object.assign(response, {
            contentType: getHTKContentType(response.headers['content-type'])
        });
        exchange.category = getExchangeCategory(exchange);

        exchange.searchIndex.push(
            response.statusCode.toString(),
            response.statusMessage.toString(),
            ..._.map(response.headers, (value, key) => `${key}: ${value}`)
        );
    }

    @action.bound
    clearExchanges() {
        this.exchanges.clear();
    }

    async activateInterceptor(interceptorId: string) {
        await activateInterceptor(interceptorId, this.server.port).catch(console.warn);
        await this.refreshInterceptors();
    }

}