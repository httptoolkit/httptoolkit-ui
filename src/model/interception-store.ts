import * as _ from 'lodash';

import { observable, action, configure, flow, computed, runInAction } from 'mobx';
import { getLocal, Mockttp } from 'mockttp';

import { InputRequest, InputResponse } from '../types';
import { HttpExchange } from './exchange';
import { parseSource } from './sources';
import { getInterceptors, activateInterceptor, getConfig, announceServerReady } from './htk-client';

import * as amIUsingHtml from '../amiusing.html';
import { Interceptor, getInterceptOptions } from './interceptors';
import { delay } from '../util';
import { parseHar } from './har';

configure({ enforceActions: 'observed' });

// All later components assume the store is fully activated - that means
// all undefined/nullable fields have been set.
export type ActivatedStore = { [P in keyof InterceptionStore]: NonNullable<InterceptionStore[P]> };

// Start the server, with slowly decreasing retry frequency (up to a limit).
// Note that this never fails - any timeout to this process needs to happen elsewhere.
function startServer(server: Mockttp, maxDelay = 1000, delayMs = 200): Promise<void> {
    return server.start().catch((e) => {
        console.log('Server initialization failed', e);
        return delay(Math.min(delayMs, maxDelay))
            .then(() =>
                startServer(server, maxDelay, delayMs * 1.2)
            );
    });
}

export class InterceptionStore {

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
    private requestQueue: InputRequest[] = [];
    private responseQueue: InputResponse[] = [];
    private abortQueue: InputRequest[] = [];
    private isFlushQueued = false;

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
        this.server = getLocal({
            cors: false,
            standaloneServerUrl: 'http://127.0.0.1:45456'
        });
        this.interceptors = getInterceptOptions([]);
    }

    startServer = flow(function* (this: InterceptionStore) {
        yield startServer(this.server);
        announceServerReady();

        yield Promise.all([
            this.server.get(/^https?:\/\/amiusing\.httptoolkit\.tech$/).always().thenReply(
                200, amIUsingHtml, { 'content-type': 'text/html' }
            ).then(() =>
                this.server.anyRequest().always().thenPassThrough({
                    ignoreHostCertificateErrors: ['localhost']
                })
            ),
            this.refreshInterceptors(),
            getConfig().then((config) => {
                this.certPath = config.certificatePath
            })
        ]);

        setInterval(() => this.refreshInterceptors(), 10000);

        console.log(`Server started on port ${this.server.port}`);

        this.server.on('request', (req) => {
            if (!this.isFlushQueued) {
                this.isFlushQueued = true;
                requestAnimationFrame(this.flushQueuedUpdates);
            }

            this.requestQueue.push(req);
        });
        this.server.on('response', (res) => {
            if (!this.isFlushQueued) {
                this.isFlushQueued = true;
                requestAnimationFrame(this.flushQueuedUpdates);
            }

            this.responseQueue.push(res);
        });
        this.server.on('abort', (req) => {
            if (!this.isFlushQueued) {
                this.isFlushQueued = true;
                requestAnimationFrame(this.flushQueuedUpdates);
            }

            this.abortQueue.push(req);
        });

        window.addEventListener('beforeunload', () => {
            this.server.stop().catch(() => { });
        });
    });

    @action.bound
    private flushQueuedUpdates() {
        this.isFlushQueued = false;

        // We batch request updates until here. This runs in a mobx transaction, and
        // on request animation frame, so batches get larger and cheaper if
        // the frame rate starts to drop.

        this.requestQueue.forEach((req) => this.addRequest(req));
        this.requestQueue = [];

        this.responseQueue.forEach((res) => this.setResponse(res));
        this.responseQueue = [];

        this.abortQueue.forEach((req) => this.markRequestAborted(req));
        this.abortQueue = [];
    }

    async refreshInterceptors() {
        const serverInterceptors = await getInterceptors(this.server.port);

        runInAction(() => {
            this.interceptors = getInterceptOptions(serverInterceptors);
        });
    }

    @action
    private addRequest(request: InputRequest) {
        const exchange = new HttpExchange(request);

        this.exchanges.push(exchange);
    }

    @action
    private markRequestAborted(request: InputRequest) {
        const exchange = _.find(this.exchanges, { id: request.id });

        // Shouldn't happen in general, but possible in some very rare cases
        if (!exchange) return;

        exchange.markAborted(request);
    }

    @action
    private setResponse(response: InputResponse) {
        const exchange = _.find(this.exchanges, { id: response.id });

        // Shouldn't happen in general, but possible in some very rare cases
        if (!exchange) return;

        exchange.setResponse(response);
    }

    @action.bound
    clearExchanges() {
        this.exchanges.clear();
    }

    async loadFromHar(harContents: {}) {
        const { requests, responses, aborts } = await parseHar(harContents);

        // Arguably we could call addRequest/setResponse directly, but this is a little
        // nicer just in case the UI thread is already under strain.
        requests.forEach(r => this.requestQueue.push(r));
        responses.forEach(r => this.responseQueue.push(r));
        aborts.forEach(r => this.abortQueue.push(r));

        if (!this.isFlushQueued) {
            this.isFlushQueued = true;
            requestAnimationFrame(this.flushQueuedUpdates);
        }
    }

    async activateInterceptor(interceptorId: string) {
        await activateInterceptor(interceptorId, this.server.port).catch(console.warn);
        await this.refreshInterceptors();
    }

}