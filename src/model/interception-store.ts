import * as _ from 'lodash';

import { observable, action, configure, flow, computed, runInAction, observe, autorun } from 'mobx';
import { persist, create } from 'mobx-persist';
import * as uuid from 'uuid/v4';
import { HarParseError } from 'har-validator';

import { getLocal, Mockttp } from 'mockttp';

import { InputResponse, FailedTlsRequest, InputTlsRequest, PortRange, InputInitiatedRequest, InputCompletedRequest } from '../types';
import { HttpExchange } from './exchange';
import { parseSource } from './sources';
import { getInterceptors, activateInterceptor, getConfig, announceServerReady } from '../services/server-api';
import { AccountStore } from './account/account-store';
import { Interceptor, getInterceptOptions } from './interceptors';
import { delay } from '../util';
import { parseHar } from './har';
import { reportError } from '../errors';
import { isValidPort } from './network';
import { buildDefaultRules, HtkMockRule } from './rules/rules';

configure({ enforceActions: 'observed' });

// All later components assume the store is fully activated - that means
// all undefined/nullable fields have been set.
export type ActivatedStore = { [P in keyof InterceptionStore]: NonNullable<InterceptionStore[P]> };

// Start the server, with slowly decreasing retry frequency (up to a limit).
// Note that this never fails - any timeout to this process needs to happen elsewhere.
function startServer(server: Mockttp, portConfig: PortRange | undefined, maxDelay = 1000, delayMs = 200): Promise<void> {
    return server.start(portConfig).catch((e) => {
        console.log('Server initialization failed', e);

        if (e.response) {
            // Server is listening, but failed to start as requested. Almost
            // certainly means our port config is bad - retry immediately without it.
            return startServer(server, undefined, maxDelay, delayMs);
        }

        // For anything else (unknown errors, or more likely server not listening yet),
        // wait briefly and then retry the same config:
        return delay(Math.min(delayMs, maxDelay)).then(() =>
            startServer(server, portConfig, maxDelay, delayMs * 1.2)
        );
    });
}

export function isValidPortConfiguration(portConfig: PortRange | undefined) {
    return portConfig === undefined || (
        portConfig.endPort >= portConfig.startPort &&
        isValidPort(portConfig.startPort) &&
        isValidPort(portConfig.endPort)
    );
}

export class InterceptionStore {

    // ** Overall setup & startup:

    constructor() {
        this.server = getLocal({
            cors: false,
            standaloneServerUrl: 'http://127.0.0.1:45456'
        });
        this.interceptors = getInterceptOptions([]);
    }

    async initialize(accountStore: AccountStore) {
        await this.loadSettings(accountStore);
        await this.startIntercepting();
    }

    private async loadSettings(accountStore: AccountStore) {
        // Every time the user account data is updated from the server, consider resetting
        // paid settings to the free defaults. This ensures that they're reset on
        // logout & subscription expiration (even if that happened while the app was
        // closed), but don't get reset when the app starts with stale account data.
        observe(accountStore, 'accountDataLastUpdated', () => {
            if (!accountStore.isPaidUser) {
                this.setPortConfig(undefined);
                this.whitelistedCertificateHosts = ['localhost'];
            }
        });

        // Load all persisted settings from storage
        await create()('interception-store', this);

        // Rebuild any other data that depends on persisted settings:
        this.interceptionRules = buildDefaultRules(this.whitelistedCertificateHosts);
        this.initiallyWhitelistedCertificateHosts = _.clone(this.whitelistedCertificateHosts);
    }

    private startIntercepting = flow(function* (this: InterceptionStore) {
        yield startServer(this.server, this._portConfig);
        announceServerReady();

        yield Promise.all([
            new Promise((resolve) => {
                // Autorun server rule configuration, so its rerun if rules change later
                autorun(() =>
                    // Interception setup waits on this, i.e. until setRules first succeeds
                    resolve(
                        // Set the mocking rules that will be used by the server. We have to
                        // clone so that we retain the pre-serialization definitions.
                        this.server.setRules(..._.cloneDeep(this.interceptionRules))
                    )
                )
            }),
            this.refreshInterceptors(),
            getConfig().then((config) => {
                this.certPath = config.certificatePath
            })
        ]);

        const refreshInterceptorInterval = setInterval(() =>
            this.refreshInterceptors()
        , 10000);

        console.log(`Server started on port ${this.server.port}`);

        this.server.on('request-initiated', (req) => {
            if (this.isPaused) return;

            if (!this.isFlushQueued) {
                this.isFlushQueued = true;
                requestAnimationFrame(this.flushQueuedUpdates);
            }

            this.requestInitiatedQueue.push(req);
        });
        this.server.on('request', (req) => {
            if (this.isPaused) return;

            if (!this.isFlushQueued) {
                this.isFlushQueued = true;
                requestAnimationFrame(this.flushQueuedUpdates);
            }

            this.requestCompletedQueue.push(req);
        });
        this.server.on('response', (res) => {
            if (this.isPaused) return;

            if (!this.isFlushQueued) {
                this.isFlushQueued = true;
                requestAnimationFrame(this.flushQueuedUpdates);
            }

            this.responseQueue.push(res);
        });
        this.server.on('abort', (req) => {
            if (this.isPaused) return;

            if (!this.isFlushQueued) {
                this.isFlushQueued = true;
                requestAnimationFrame(this.flushQueuedUpdates);
            }

            this.abortQueue.push(req);
        });
        this.server.on('tlsClientError', (req: InputTlsRequest) => {
            if (this.isPaused) return;

            if (!this.isFlushQueued) {
                this.isFlushQueued = true;
                requestAnimationFrame(this.flushQueuedUpdates);
            }

            this.tlsErrorQueue.push(req);
        });

        window.addEventListener('beforeunload', () => {
            clearInterval(refreshInterceptorInterval);
            this.server.stop().catch(() => { });
        });
    });

    // ** Core server config

    @observable.ref
    private server: Mockttp;

    @observable
    certPath: string | undefined;

    @persist('object') @observable
    private _portConfig: PortRange | undefined;

    @computed get portConfig() {
        return this._portConfig;
    }

    @action
    setPortConfig(value: PortRange | undefined) {
        if (!isValidPortConfiguration(value)) {
            throw new TypeError(`Invalid port config: ${JSON.stringify(value)}`);
        } else if (!value || (value.startPort === 8000 && value.endPort === 65535)) {
            // If unset, or set to the default equivalent value, then
            // we delegate to the server itself.
            this._portConfig = undefined;
        } else {
            this._portConfig = value;
        }
    }

    @computed get serverPort() {
        return this.server.port;
    }

    @persist('list') @observable
    whitelistedCertificateHosts: string[] = ['localhost'];

    // Saved when the server starts, so we can compare to the current list later
    initiallyWhitelistedCertificateHosts: string[] = ['localhost'];

    // ** Rule management:

    @observable.shallow
    interceptionRules: HtkMockRule[] = buildDefaultRules(['localhost']);

    @observable
    unsavedInterceptionRules: HtkMockRule[] = _.cloneDeep(this.interceptionRules);

    @action.bound
    saveInterceptionRules() {
        this.interceptionRules = this.unsavedInterceptionRules;
        this.unsavedInterceptionRules = _.cloneDeep(this.interceptionRules);
    }

    @computed
    get areSomeRulesUnsaved() {
        return !_.isEqual(this.interceptionRules, this.unsavedInterceptionRules);
    }

    // ** Interceptors:

    @observable interceptors: _.Dictionary<Interceptor>;

    async refreshInterceptors() {
        const serverInterceptors = await getInterceptors(this.server.port);

        runInAction(() => {
            this.interceptors = getInterceptOptions(serverInterceptors);
        });
    }

    async activateInterceptor(interceptorId: string) {
        await activateInterceptor(interceptorId, this.server.port).catch(console.warn);
        await this.refreshInterceptors();
    }

    // ** Server event subscriptions:

    @observable
    isPaused = false;

    // TODO: Combine into a batchedEvent queue of callbacks
    private requestInitiatedQueue: InputInitiatedRequest[] = [];
    private requestCompletedQueue: InputCompletedRequest[] = [];
    private responseQueue: InputResponse[] = [];
    private abortQueue: InputInitiatedRequest[] = [];
    private tlsErrorQueue: InputTlsRequest[] = [];
    private isFlushQueued = false;

    readonly events = observable.array<HttpExchange | FailedTlsRequest>([], { deep: false });

    @computed
    get exchanges(): Array<HttpExchange> {
        return this.events.filter(
            (event: any): event is HttpExchange => !!event.request
        );
    }

    @computed get activeSources() {
        return _(this.exchanges)
            .map(e => e.request.headers['user-agent'])
            .uniq()
            .map(parseSource)
            .uniqBy(s => s.summary)
            .value();
    }

    @action.bound
    private flushQueuedUpdates() {
        this.isFlushQueued = false;

        // We batch request updates until here. This runs in a mobx transaction, and
        // on request animation frame, so batches get larger and cheaper if
        // the frame rate starts to drop.

        this.requestInitiatedQueue.forEach((req) => this.addInitiatedRequest(req));
        this.requestInitiatedQueue = [];

        this.requestCompletedQueue.forEach((req) => this.addCompletedRequest(req));
        this.requestCompletedQueue = [];

        this.responseQueue.forEach((res) => this.setResponse(res));
        this.responseQueue = [];

        this.abortQueue.forEach((req) => this.markRequestAborted(req));
        this.abortQueue = [];

        this.tlsErrorQueue.forEach((req) => this.addFailedTlsRequest(req));
        this.tlsErrorQueue = [];
    }

    @action.bound
    togglePause() {
        this.isPaused = !this.isPaused;
    }

    @action
    private addInitiatedRequest(request: InputInitiatedRequest) {
        try {
            // Due to race conditions, it's possible this request already exists. If so,
            // we just skip this - the existing data will be more up to date.
            const existingEventIndex = _.findIndex(this.events, { id: request.id });
            if (existingEventIndex === -1) {
                const exchange = new HttpExchange(request);
                this.events.push(exchange);
            }
        } catch (e) {
            reportError(e);
        }
    }

    @action
    private addCompletedRequest(request: InputCompletedRequest) {
        try {
            const exchange = new HttpExchange(request);

            // The request shuld already exist: we get an event when the initial path & headers
            // are received, and this one later when the body etc arrives.
            // We add it from scratch if not, in case of races or if the server doesn't support
            // request-initiated events.
            const existingEventIndex = _.findIndex(this.events, { id: request.id });
            if (existingEventIndex >= 0) {
                this.events[existingEventIndex] = exchange;
            } else {
                this.events.push(exchange);
            }
        } catch (e) {
            reportError(e);
        }
    }

    @action
    private markRequestAborted(request: InputInitiatedRequest) {
        try {
            const exchange = _.find(this.exchanges, { id: request.id });

            // Should only happen in rare cases - e.g. paused for req, unpaused before res
            if (!exchange) return;

            exchange.markAborted(request);
        } catch (e) {
            reportError(e);
        }
    }

    @action
    private setResponse(response: InputResponse) {
        try {
            const exchange = _.find(this.exchanges, { id: response.id });

            // Should only happen in rare cases - e.g. paused for req, unpaused before res
            if (!exchange) {
                reportError('Response event received for missing request');
                return;
            }

            exchange.setResponse(response);
        } catch (e) {
            reportError(e);
        }
    }

    @action
    private addFailedTlsRequest(request: InputTlsRequest) {
        try {
            if (_.some(this.events, (event) =>
                'hostname' in event &&
                event.hostname === request.hostname &&
                event.remoteIpAddress === request.remoteIpAddress
            )) return; // Drop duplicate TLS failures

            this.events.push(Object.assign(request, {
                id: uuid(),
                searchIndex: [request.hostname, request.remoteIpAddress]
                    .filter((x): x is string => !!x)
            }));
        } catch (e) {
            reportError(e);
        }
    }

    @action.bound
    clearInterceptedData() {
        this.events.clear();
    }

    async loadFromHar(harContents: {}) {
        const { requests, responses, aborts } = await parseHar(harContents)
            .catch((harParseError: HarParseError) => {
                // Log all suberrors, for easier reporting & debugging.
                // This does not include HAR data - only schema errors like
                // 'bodySize is missing' at 'entries[1].request'
                harParseError.errors.forEach((error) => {
                    console.log(error);
                });
                throw harParseError;
            });

        // Arguably we could call addRequest/setResponse directly, but this is a little
        // nicer just in case the UI thread is already under strain.
        requests.forEach(r => this.requestCompletedQueue.push(r));
        responses.forEach(r => this.responseQueue.push(r));
        aborts.forEach(r => this.abortQueue.push(r));

        if (!this.isFlushQueued) {
            this.isFlushQueued = true;
            requestAnimationFrame(this.flushQueuedUpdates);
        }
    }

}