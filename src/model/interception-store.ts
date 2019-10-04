import * as _ from 'lodash';

import {
    observable,
    action,
    configure,
    flow,
    computed,
    runInAction,
    observe,
    autorun,
    when
} from 'mobx';
import { persist, create } from 'mobx-persist';
import * as uuid from 'uuid/v4';
import { HarParseError } from 'har-validator';

import { getLocal, Mockttp } from 'mockttp';

import {
    InputResponse,
    FailedTlsRequest,
    InputTlsRequest,
    PortRange,
    InputInitiatedRequest,
    InputCompletedRequest,
    MockttpBreakpointedRequest,
    MockttpBreakpointedResponse
} from '../types';
import { HttpExchange } from './exchange';
import { parseSource } from './sources';
import {
    getInterceptors,
    activateInterceptor,
    getConfig,
    announceServerReady
} from '../services/server-api';
import { AccountStore } from './account/account-store';
import { Interceptor, getInterceptOptions } from './interceptors';
import { delay } from '../util';
import { parseHar } from './har';
import { reportError } from '../errors';
import { isValidPort } from './network';
import { buildDefaultRules, HtkMockRule, ruleEquality, buildForwardingRuleIntegration } from './rules/rules';
import { deserializeRules } from './rules/rule-serialization';
import { getDesktopInjectedValue } from '../services/desktop-api';
import { ForwardToHostHandler } from './rules/rule-definitions';

configure({ enforceActions: 'observed' });

type WithSet<T, K extends keyof T> = T & { [k in K]: NonNullable<T[k]> };

// All later components assume the store is fully activated - that means
// all undefined/nullable fields have been set.
export type ActivatedStore = WithSet<InterceptionStore, 'certPath' | 'portConfig'>;

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

// Would be nice to magically infer this from the overloaded on() type, but sadly:
// https://github.com/Microsoft/TypeScript/issues/24275#issuecomment-390701982
type EventTypesMap = {
    'request-initiated': InputInitiatedRequest
    'request': InputCompletedRequest
    'response': InputResponse
    'abort': InputInitiatedRequest
    'tlsClientError': InputTlsRequest
};

const eventTypes = [
    'request-initiated',
    'request',
    'response',
    'abort',
    'tlsClientError'
] as const;

type EventType = typeof eventTypes[number];

type QueuedEvent = ({
    [T in EventType]: { type: T, event: EventTypesMap[T] }
}[EventType]);

type OrphanableQueuedEvent =
    | { type: 'response', event: InputResponse }
    | { type: 'abort', event: InputInitiatedRequest };

export class InterceptionStore {

    // ** Overall setup & startup:
    //#region

    constructor(
        private readonly jumpToExchange: (exchangeId: string) => void
    ) {
        this.server = getLocal({
            cors: false,
            suggestChanges: false,
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
                this.draftWhitelistedCertificateHosts = ['localhost'];
            }
        });

        // Load all persisted settings from storage
        await create()('interception-store', this);

        // Backward compat for store data before 2019-10-04 - drop this in a month or two
        const rawData = localStorage.getItem('interception-store');
        if (rawData) {
            try {
                const data = JSON.parse(rawData);
                // Handle the migration from WL + initiallyWL to WL + draftWL.
                if (data.whitelistedCertificateHosts && !data.draftWhitelistedCertificateHosts) {
                    runInAction(() => {
                        this.draftWhitelistedCertificateHosts = data.whitelistedCertificateHosts;
                    });
                }
            } catch (e) {
                console.log(e);
            }
        }

        // Support injection of a default forwarding rule by the desktop app, for integrations
        getDesktopInjectedValue('httpToolkitForwardingDefault').then(action((forwardingConfig: string) => {
            const [sourceHost, targetHost] = forwardingConfig.split('|');
            const forwardingRule = buildForwardingRuleIntegration(sourceHost, targetHost, this);

            this.rules.unshift(forwardingRule);
            this.draftRules.unshift(_.cloneDeep(forwardingRule));
        }));

        // On startup the draft host settings take effect, becoming the real settings.
        this.whitelistedCertificateHosts = _.clone(this.draftWhitelistedCertificateHosts);

        // Rebuild the rules, which might depends on these settings:
        this.resetRulesToDefault();
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
                        this.server.setRules(
                            ..._.cloneDeep(this.rules.filter(
                                // Drop inactive or never-matching rules
                                r => r.activated && r.matchers.length
                            ))
                        )
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

        eventTypes.forEach(<T extends EventType>(eventName: T) => {
            // Lots of 'any' because TS can't handle overload + type interception
            this.server.on(eventName as any, ((eventData: EventTypesMap[T]) => {
                if (this.isPaused) return;
                this.eventQueue.push({ type: eventName, event: eventData } as any);
                this.queueEventFlush();
            }) as any);
        });

        window.addEventListener('beforeunload', () => {
            clearInterval(refreshInterceptorInterval);
            this.server.stop().catch(() => { });
        });
    });

    //#endregion
    // ** Core server config
    //#region

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

    // The currently active list, set during startup
    whitelistedCertificateHosts: string[] = ['localhost'];

    // The desired list - can be changed, takes effect on next app startup
    @persist('list') @observable
    draftWhitelistedCertificateHosts: string[] = ['localhost'];

    //#endregion
    // ** Rules:
    //#region

    @observable.shallow
    rules: HtkMockRule[] = buildDefaultRules(this);

    @observable
    draftRules: HtkMockRule[] = _.cloneDeep(this.rules);

    @action.bound
    saveRules() {
        this.rules = this.draftRules;
        this.resetRuleDrafts();
    }

    @action.bound
    resetRuleDrafts() {
        // Set the rules back to the latest saved version
        this.draftRules = _.cloneDeep(this.rules);
    }

    @action.bound
    resetRulesToDefault() {
        // Set the rules back to the default settings
        this.rules = buildDefaultRules(this);
        this.resetRuleDrafts();
    }

    @computed
    get areSomeRulesUnsaved() {
        return !_.isEqualWith(this.draftRules, this.rules, ruleEquality);
    }

    @computed
    get areSomeRulesNonDefault() {
        const defaultRules = buildDefaultRules(this);
        return !_.isEqualWith(this.draftRules, defaultRules, ruleEquality);
    }

    @action.bound
    resetRule(draftRuleIndex: number) {
        // To reset a single rule, we reset the content of that rule, and reset only its
        // position (different to save rule: see below). The difference is because this
        // is a clear & visible change, so doing the smaller move makes more sense.

        const { draftRules, rules: activeRules } = this;

        const draftRule = draftRules[draftRuleIndex];
        const id = draftRule.id;

        const existingRule = _.find(activeRules, { id });

        if (!existingRule) return;
        // Update the rule content:
        draftRules[draftRuleIndex] = _.cloneDeep(existingRule);

        const activeRulesIntersection = _.intersectionBy(activeRules, draftRules, 'id');
        const draftRulesIntersection = _.intersectionBy(draftRules, activeRules, 'id');

        if (
            activeRulesIntersection.indexOf(existingRule) ===
            draftRulesIntersection.indexOf(draftRule)
        ) {
            // If this rule is effectively in the right place already, we're done
            return;
        }

        // If not, find where it should go:
        const targetIndex = activeRules.indexOf(existingRule);
        let [movedRule] = draftRules.splice(draftRuleIndex, 1);
        draftRules.splice(Math.min(targetIndex, draftRules.length), 0, movedRule);
    }

    @action.bound
    saveRule(draftRuleIndex: number) {
        // To update a single rule, we update the content of that single rule, but if its
        // position has changed then we update the position of all rules. It's very hard
        // to update the position of one predictable, and the saved state is invisible,
        // so it's better to just give consistency.
        // This should doe what you expect for simple states (one or two moves), and
        // is at least predictable & transparent in pathological cases.

        const { draftRules, rules: activeRules } = this;
        const draftRule = draftRules[draftRuleIndex];
        const id = draftRule.id;

        const existingRuleIndex = _.findIndex(activeRules, { id });
        if (existingRuleIndex !== -1) {
            // If this rule already exists, update it
            activeRules[existingRuleIndex] = _.cloneDeep(draftRule);
        } else {
            // If not, insert it (it'll be sorted to the right place behlow)
            activeRules.push(_.cloneDeep(draftRule));
        }

        const draftDeletedRules = _.differenceBy(activeRules, draftRules, 'id');
        const activeRulesIntersection = _.intersectionBy(activeRules, draftRules, 'id');
        const draftRulesIntersection = _.intersectionBy(draftRules, activeRules, 'id');

        if (
            _.findIndex(draftRulesIntersection, { id }) ===
            _.findIndex(activeRulesIntersection, { id })
        ) {
            // If this rule is effectively in the right place already, we're done
            return;
        }

        // Sort the existing rules by their updated positions
        const sortedRules = _.sortBy(activeRulesIntersection,
            rule => _.findIndex(draftRules, { id: rule.id })
        );

        // Reinsert draft-deleted rules:
        draftDeletedRules.forEach((rule) => {
            const previousIndex = Math.min(activeRules.indexOf(rule), activeRules.length);
            sortedRules.splice(previousIndex, 0, rule);
        });

        this.rules = sortedRules;
    }

    @action.bound
    loadSavedRules(savedData: any) {
        this.rules = deserializeRules(savedData, { interceptionStore: this });
        this.resetRuleDrafts();
    }

    //#endregion
    // ** Interceptors:
    //#region

    @observable interceptors: _.Dictionary<Interceptor>;

    async refreshInterceptors() {
        const serverInterceptors = await getInterceptors(this.server.port);

        runInAction(() => {
            this.interceptors = getInterceptOptions(serverInterceptors);
        });
    }

    async activateInterceptor(interceptorId: string) {
        const result = await activateInterceptor(interceptorId, this.server.port)
            .then(() => true)
            .catch((e) => {
                console.warn(e);
                return false;
            });
        await this.refreshInterceptors();
        return result;
    }

    //#endregion
    // ** Server event subscriptions:
    //#region

    @observable
    isPaused = false;

    private eventQueue: Array<QueuedEvent> = [];
    private orphanedEvents: { [id: string]: OrphanableQueuedEvent } = {};

    private isFlushQueued = false;
    private queueEventFlush() {
        if (!this.isFlushQueued) {
            this.isFlushQueued = true;
            requestAnimationFrame(this.flushQueuedUpdates);
        }
    }

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

        // We batch request updates until here. This runs in a mobx transaction and
        // on request animation frame, so batches get larger and cheaper if
        // the frame rate starts to drop.

        this.eventQueue.forEach(this.updateFromQueuedEvent);
        this.eventQueue = [];
    }

    private updateFromQueuedEvent = (queuedEvent: QueuedEvent) => {
        switch (queuedEvent.type) {
            case 'request-initiated':
                this.addInitiatedRequest(queuedEvent.event);
                return this.checkForOrphan(queuedEvent.event.id);
            case 'request':
                this.addCompletedRequest(queuedEvent.event);
                return this.checkForOrphan(queuedEvent.event.id);
            case 'response':
                return this.setResponse(queuedEvent.event);
            case 'abort':
                return this.markRequestAborted(queuedEvent.event);
            case 'tlsClientError':
                return this.addFailedTlsRequest(queuedEvent.event);
        }
    }

    private checkForOrphan(id: string) {
        // Sometimes we receive events out of order (response/abort before request).
        // They could be later in the same batch, or in a previous batch. If that happens,
        // we store them separately, and we check later whether they're valid when subsequent
        // completed/initiated request events come in. If so, we re-queue them.

        const orphanEvent = this.orphanedEvents[id];

        if (orphanEvent) {
            delete this.orphanedEvents[id];
            this.updateFromQueuedEvent(orphanEvent);
        }
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
            // The request should already exist: we get an event when the initial path & headers
            // are received, and this one later when the full body is received.
            // We add the request from scratch if it's somehow missing, which can happen given
            // races or if the server doesn't support request-initiated events.
            const existingEventIndex = _.findIndex(this.events, { id: request.id });
            if (existingEventIndex >= 0) {
                (this.events[existingEventIndex] as HttpExchange).updateFromCompletedRequest(request);
            } else {
                this.events.push(new HttpExchange(request));
            }
        } catch (e) {
            reportError(e);
        }
    }

    @action
    private markRequestAborted(request: InputInitiatedRequest) {
        try {
            const exchange = _.find(this.exchanges, { id: request.id });

            if (!exchange) {
                // Handle this later, once the request has arrived
                this.orphanedEvents[request.id] = { type: 'abort', event: request };
                return;
            };

            exchange.markAborted(request);
        } catch (e) {
            reportError(e);
        }
    }

    @action
    private setResponse(response: InputResponse) {
        try {
            const exchange = _.find(this.exchanges, { id: response.id });

            if (!exchange) {
                // Handle this later, once the request has arrived
                this.orphanedEvents[response.id] = { type: 'response', event: response };
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
        this.orphanedEvents = {};
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
        requests.forEach(r => this.eventQueue.push({ type: 'request', event: r }));
        responses.forEach(r => this.eventQueue.push({ type: 'response', event: r }));
        aborts.forEach(r => this.eventQueue.push({ type: 'abort', event: r }));

        this.queueEventFlush();
    }

    readonly triggerRequestBreakpoint = (request: MockttpBreakpointedRequest) => {
        return this.triggerBreakpoint(
            request.id,
            (exchange: HttpExchange) => exchange.triggerRequestBreakpoint(request)
        );
    }

    readonly triggerResponseBreakpoint = (response: MockttpBreakpointedResponse) => {
        return this.triggerBreakpoint(
            response.id,
            (exchange: HttpExchange) => exchange.triggerResponseBreakpoint(response)
        );
    }

    private triggerBreakpoint = flow(function * <T>(
        this: InterceptionStore,
        eventId: string,
        getEditedEvent: (exchange: HttpExchange) => Promise<T>
    ) {
        let exchange: HttpExchange | undefined;

        // Wait until the event itself has arrived in the UI:
        yield when(() => {
            exchange = _.find(this.exchanges, { id: eventId });

            // Completed -> doesn't fire for initial requests -> no completed/initial req race
            return !!exchange && exchange.isCompletedRequest();
        });

        // Jump to the exchange:
        this.jumpToExchange(eventId);

        // Mark the exchange as breakpointed, and wait for an edited version.
        // UI will make it editable, add a save button, save will resolve this promise
        return (yield getEditedEvent(exchange!)) as T;
    });

    //#endregion
}