import * as _ from 'lodash';

import {
    observable,
    action,
    configure,
    flow,
    computed,
    runInAction,
    observe,
    when,
    reaction
} from 'mobx';
import { persist, create } from 'mobx-persist';
import * as uuid from 'uuid/v4';
import { HarParseError } from 'har-validator';
import * as serializr from 'serializr';
import { encode as encodeBase64, decode as decodeBase64 } from 'base64-arraybuffer';

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
    announceServerReady,
} from '../services/server-api';
import { serverVersion as serverVersionPromise } from '../services/service-versions';
import { AccountStore } from './account/account-store';
import { Interceptor, getInterceptOptions } from './interceptors';
import { delay } from '../util';
import { parseHar } from './har';
import { reportError } from '../errors';
import { isValidPort } from './network';
import {
    HtkMockRuleGroup,
    flattenRules,
    ItemPath,
    isRuleGroup,
    getItemAtPath,
    getItemParentByPath,
    updateItemAtPath,
    deleteItemAtPath,
    findItem,
    findItemPath,
    HtkMockRuleRoot,
    isRuleRoot,
    HtkMockItem,
    HtkMockRule,
    areItemsEqual
} from './rules/rules-structure';
import {
    buildDefaultRules,
    buildForwardingRuleIntegration
} from './rules/rule-definitions';
import { deserializeRules } from './rules/rule-serialization';
import { getDesktopInjectedValue } from '../services/desktop-api';

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

export type ClientCertificate = {
    readonly pfx: ArrayBuffer,
    readonly passphrase?: string,
    readonly filename: string
};

const pojoSchema = (props: serializr.Props) => ({
    factory: () => ({}),
    props: props
});

const clientCertificateSchema = pojoSchema({
    passphrase: serializr.primitive(),
    filename: serializr.primitive(),
    pfx: serializr.custom(encodeBase64, decodeBase64)
});

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
                this.draftClientCertificateHostMap = {};
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

            this.rules.items.unshift(forwardingRule);
            this.draftRules.items.unshift(_.cloneDeep(forwardingRule));
        }));

        // On startup the draft host settings take effect, becoming the real settings:
        this.whitelistedCertificateHosts = _.clone(this.draftWhitelistedCertificateHosts);
        this.clientCertificateHostMap = _.clone(this.draftClientCertificateHostMap);

        // Rebuild the rules, which might depends on these settings:
        this.resetRulesToDefault();
    }

    private startIntercepting = flow(function* (this: InterceptionStore) {
        yield startServer(this.server, this._portConfig);
        announceServerReady();

        yield Promise.all([
            new Promise((resolve) => {
                // Autorun server rule configuration, so reruns if effective rules change later
                reaction(
                    () => _.cloneDeep( // Clone to retain the pre-serialization definitions.
                        flattenRules(this.rules)
                        // Drop inactive or never-matching rules
                        .filter(r => r.activated && r.matchers.length),
                    ),
                    (rules) => resolve(this.server.setRules(...rules)),
                    { fireImmediately: true }
                )
            }),
            this.refreshInterceptors(),
            getConfig().then((config) => {
                this.certPath = config.certificatePath;
                this.certContent = config.certificateContent;
                this.certFingerprint = config.certificateFingerprint;
                this.networkAddresses = _.flatMap(config.networkInterfaces, (addresses) => {
                    return addresses
                        .filter(a => !a.internal)
                        .map(a => a.address);
                });
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

    @observable
    certContent: string | undefined;

    @observable
    certFingerprint: string | undefined;

    @observable
    networkAddresses: string[] | undefined;

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

    get activePassthroughOptions() {
        return {
            ignoreHostCertificateErrors: this.whitelistedCertificateHosts,
            clientCertificateHostMap: _.mapValues(this.clientCertificateHostMap, (cert) => ({
                pfx: Buffer.from(cert.pfx),
                passphrase: cert.passphrase
            }))
        }
    }

    // The currently active list, set during startup
    private whitelistedCertificateHosts: string[] = ['localhost'];

    // The desired list - can be changed, takes effect on next app startup
    @persist('list') @observable
    draftWhitelistedCertificateHosts: string[] = ['localhost'];

    readonly areWhitelistedCertificatesUpToDate = () => {
        return _.isEqual(this.whitelistedCertificateHosts, this.draftWhitelistedCertificateHosts);
    }

    readonly isWhitelistedCertificateSaved = (host: string) => {
        return this.whitelistedCertificateHosts.includes(host);
    }

    // The currently active client certificates
    private clientCertificateHostMap: { [host: string]: ClientCertificate } = {};

    // The desired set of client certificates - takes effect on next startup
    @persist('map', clientCertificateSchema) @observable
    draftClientCertificateHostMap: { [host: string]: ClientCertificate } = _.clone(
        this.clientCertificateHostMap
    );

    readonly areClientCertificatesUpToDate = () => {
        return _.isEqual(this.clientCertificateHostMap, this.draftClientCertificateHostMap);
    }

    readonly isClientCertificateUpToDate = (host: string) => {
        return _.isEqual(this.clientCertificateHostMap[host], this.draftClientCertificateHostMap[host]);
    }


    //#endregion
    // ** Rules:
    //#region

    @observable
    rules: HtkMockRuleRoot = buildDefaultRules(this);

    @observable
    draftRules: HtkMockRuleRoot = _.cloneDeep(this.rules);

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
        return !_.isEqualWith(this.draftRules, this.rules, areItemsEqual);
    }

    @computed
    get areSomeRulesNonDefault() {
        const defaultRules = buildDefaultRules(this);
        return !_.isEqualWith(this.draftRules, defaultRules, areItemsEqual);
    }

    @action.bound
    resetRule(draftItemPath: ItemPath) {
        // To reset a single rule, we reset the group & content of that rule, resetting only the
        // position of this one rule (different to save rule: see below). The difference is because
        // this is a clear & visible change, so doing the smaller move is easy & makes more sense.

        const { draftRules, rules: activeRules } = this;

        const draftRule = getItemAtPath(draftRules, draftItemPath);
        if (isRuleGroup(draftRule)) throw new Error("Can't reset single rule group");
        const id = draftRule.id;

        const activeRulePath = findItemPath(activeRules, { id });
        if (!activeRulePath) throw new Error("Can't reset a new rule");

        const activeRule = getItemAtPath(activeRules, activeRulePath);

        // Update the rule content:

        const activeParent = getItemParentByPath(activeRules, activeRulePath);
        const currentDraftParent = getItemParentByPath(draftRules, draftItemPath);
        let targetDraftParent = findItem(draftRules, { id: activeParent.id }) as HtkMockRuleGroup;

        if (!targetDraftParent) {
            let missingParents = [activeParent];
            // Loop up until we find a parent that _does_ exist, and then insert all
            // missing parents from that point.
            while (missingParents.length) {
                const missingParentsActivePath = activeRulePath.slice(0, -missingParents.length);
                const nextActiveParent = getItemParentByPath(activeRules, missingParentsActivePath);

                const targetDraftParentParent = findItem(draftRules, { id: nextActiveParent.id }) as HtkMockRuleGroup;

                if (targetDraftParentParent) {
                    targetDraftParent = missingParents.reduce(({ draftParent, activeParent }, missingGroup) => {
                        const newGroup = observable(_.clone(_.omit(missingGroup, 'items')));
                        newGroup.items = [];

                        const draftCommonSiblings = _.intersectionBy(draftParent.items, activeParent.items, 'id');
                        const activeCommonSiblings = _.intersectionBy(activeParent.items, draftParent.items.concat(missingGroup), 'id');

                        const targetSiblingIndex = _.findIndex(activeCommonSiblings, { id: missingGroup.id });

                        if (targetSiblingIndex > 0) {
                            const targetPredecessor = draftCommonSiblings[targetSiblingIndex - 1];
                            const targetIndex = _.findIndex(draftParent.items, { id: targetPredecessor.id }) + 1;
                            draftParent.items.splice(targetIndex, 0, newGroup);
                        } else {
                            draftParent.items.unshift(newGroup);
                        }

                        return {
                            draftParent: newGroup,
                            activeParent: missingGroup
                        };
                    }, {
                        draftParent: targetDraftParentParent,
                        activeParent: nextActiveParent
                    }).draftParent;
                    missingParents = [];
                } else {
                    missingParents.unshift(nextActiveParent);
                }
            }
        }

        // We now have the active & draft rules, and the draft parent that _should_ contain the draft rule

        const resetRule = _.cloneDeep(activeRule);

        // Update & potentially reparent the rule:

        if (currentDraftParent.id === targetDraftParent.id) {
            updateItemAtPath(draftRules, draftItemPath, resetRule);
        } else {
            // We're moving parent. Before rearranging it, we need to reparent the draft element.
            _.remove(currentDraftParent.items, { id: resetRule.id });
            targetDraftParent.items.splice(0, 0, resetRule); // Put it at the start: we'll rearrange below
            if (currentDraftParent.items.length === 0 && !isRuleRoot(currentDraftParent)) {
                this.deleteDraftRule(findItemPath(this.draftRules, { id: currentDraftParent.id })!);
            }
        }

        // Check the rule's position relative to its siblings, reset it if necessary:

        const draftSiblings = targetDraftParent.items;
        const activeSiblings = activeParent.items;

        // Find the common (still present in active & draft) items in this group, in two sets:
        // one by their order in the draft rules, one by their order in the active rules.
        const draftCommonSiblings = _.intersectionBy(draftSiblings, activeSiblings, 'id');
        const activeCommonSiblings = _.intersectionBy(activeSiblings, draftSiblings, 'id');

        const targetCommonIndex = _.findIndex(activeCommonSiblings, { id });

        // If this rule is in the right place already, we're done
        if (_.findIndex(draftCommonSiblings, { id }) === targetCommonIndex) return;

        // Otherwise, the rule is in the wrong group/place in its group.

        // Remove it from its current position:
        _.remove(draftSiblings, { id });
        _.remove(draftCommonSiblings, { id });

        // The tricky bit: place it into the first position that gives it the same position
        // within the common siblings as it has in the set of active rules.
        if (targetCommonIndex > 0) {
            const draftItemToFollow = draftCommonSiblings[targetCommonIndex - 1];
            const targetSiblingIndex = _.findIndex(draftSiblings, { id: draftItemToFollow.id }) + 1;
            draftSiblings.splice(targetSiblingIndex, 0, resetRule);
        } else {
            draftSiblings.unshift(resetRule);
        }
    }

    @action.bound
    saveItem(draftItemPath: ItemPath) {
        // To update a single item, we update the content of that single item, but if its
        // position has changed then we update the position of all items. It's very hard
        // to update the position of one predictably, and the saved state is invisible,
        // so it's better to just give consistency.
        // This should do what you expect for simple states (one or two moves), and
        // is at least predictable & transparent in pathological cases.

        const { draftRules, rules: activeRules } = this;

        const draftItem = getItemAtPath(draftRules, draftItemPath);
        const draftParent = getItemParentByPath(draftRules, draftItemPath);

        let targetActiveParent = findItem(activeRules, { id: draftParent.id }) as HtkMockRuleGroup;
        if (!targetActiveParent) {
            targetActiveParent = this.saveItem(draftItemPath.slice(0, -1)) as HtkMockRuleGroup;
        }

        const id = draftItem.id;
        const activeItemPath = findItemPath(activeRules, { id });

        const updatedItem = observable(_.cloneDeep(_.omit(draftItem, 'items')));

        // When saving a single group, save the group itself, don't change the contents
        if (isRuleGroup(draftItem)) {
            if (activeItemPath) {
                const activeItem = getItemAtPath(activeRules, activeItemPath) as HtkMockRuleGroup;
                (updatedItem as HtkMockRuleGroup).items = _.cloneDeep(activeItem.items);
            } else {
                (updatedItem as HtkMockRuleGroup).items = [];
            }
        }

        // Insert/update the item in the tree:

        if (activeItemPath) {
            // The item is active, but maybe moved.
            const currentActiveParent = getItemParentByPath(activeRules, activeItemPath);
            if (currentActiveParent === targetActiveParent) {
                // Update in place, we'll sort below
                updateItemAtPath(activeRules, activeItemPath, updatedItem);
            } else {
                // Parent changed - move the rule, we'll sort it to the exact correct position below
                const currentIndex = _.last(activeItemPath)!;
                currentActiveParent.items.splice(currentIndex, 1);
                targetActiveParent.items.push(updatedItem);

                if (currentActiveParent.items.length === 0 && !isRuleRoot(currentActiveParent)) {
                    // Parent path may have changed, if target parent an ancestor of the current parent
                    const updatedCurrentParentPath = findItemPath(activeRules, { id: currentActiveParent.id })!;
                    deleteItemAtPath(activeRules, updatedCurrentParentPath);
                }
            }
        } else {
            // The item doesn't exist yet. For now, just append it, and we'll sorted it
            // into the right position below
            targetActiveParent.items.push(updatedItem);
        }

        // Reorder this rule & all its siblings, to match the draft order:

        const draftDeletedRules = _.differenceBy(targetActiveParent.items, draftParent.items, 'id');
        const activeCommonSiblings = _.intersectionBy(targetActiveParent.items, draftParent.items, 'id');
        const draftCommonSiblings = _.intersectionBy(draftParent.items, targetActiveParent.items, 'id');

        if (_.findIndex(draftCommonSiblings, { id }) === _.findIndex(activeCommonSiblings, { id })) {
            // If this rule is effectively in the right place already, we're done
            return updatedItem;
        }

        // Sort the existing siblings by their updated positions
        const sortedItems = _.sortBy(activeCommonSiblings,
            rule => _.findIndex(draftParent.items, { id: rule.id })
        );

        // Reinsert draft-deleted rules:
        draftDeletedRules.forEach((rule) => {
            const previousIndex = Math.min(
                targetActiveParent.items.indexOf(rule),
                targetActiveParent.items.length
            );
            sortedItems.splice(previousIndex, 0, rule);
        });

        targetActiveParent.items = sortedItems;

        return updatedItem;
    }

    @action.bound
    deleteDraftRule(draftRulePath: ItemPath) {
        deleteItemAtPath(this.draftRules, draftRulePath);
    }

    @action.bound
    moveDraftRule(currentPath: ItemPath, targetPath: ItemPath) {
        const currentParent = getItemParentByPath(this.draftRules, currentPath);
        const targetParent = getItemParentByPath(this.draftRules, targetPath);

        const currentIndex = _.last(currentPath)!;
        const targetIndex = _.last(targetPath)!;

        const [item] = currentParent.items.splice(currentIndex, 1);
        targetParent.items.splice(targetIndex, 0, item);

        // If the source parent is empty, delete them completely
        if (currentParent.items.length === 0 && !isRuleRoot(currentParent)) {
            this.deleteDraftRule(findItemPath(this.draftRules, { id: currentParent.id })!);
        }
    }

    @action.bound
    combineDraftRulesAsGroup(sourcePath: ItemPath, targetPath: ItemPath) {
        const sourceItem = getItemAtPath(this.draftRules, sourcePath);

        const targetParent = getItemParentByPath(this.draftRules, targetPath);
        const targetIndex = _.last(targetPath)!;
        const targetItem = targetParent.items[targetIndex];

        targetParent.items[targetIndex] = {
            id: uuid(),
            title: "New group",
            items: [
                targetItem,
                sourceItem
            ]
        };
        this.deleteDraftRule(sourcePath);
    }

    @action.bound
    updateGroupTitle(groupId: string, newTitle: string) {
        const draftGroup = findItem(this.draftRules, { id: groupId }) as HtkMockRuleGroup;
        const activeGroup = findItem(this.rules, { id: groupId }) as (
            HtkMockRuleGroup | undefined
        );

        draftGroup.title = newTitle;
        if (activeGroup) activeGroup.title = newTitle;
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
        const serverVersion = await serverVersionPromise;

        runInAction(() => {
            this.interceptors = getInterceptOptions(serverInterceptors, serverVersion);
        });
    }

    activateInterceptor = flow(function * (
        this: InterceptionStore,
        interceptorId: string,
        options?: any
    ) {
        this.interceptors[interceptorId].inProgress = true;
        const result: unknown = yield activateInterceptor(
            interceptorId,
            this.server.port,
            options
        ).then(
            (metadata) => metadata || true
        ).catch((e) => {
            reportError(e);
            return false;
        });

        this.interceptors[interceptorId].inProgress = false;
        yield this.refreshInterceptors();

        return result;
    });

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