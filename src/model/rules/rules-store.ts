import * as _ from 'lodash';

import {
    observable,
    action,
    flow,
    computed,
    observe,
    when,
    reaction
} from 'mobx';
import { persist, create } from 'mobx-persist';
import * as uuid from 'uuid/v4';
import * as serializr from 'serializr';
import { encode as encodeBase64, decode as decodeBase64 } from 'base64-arraybuffer';

import { MockttpBreakpointedRequest, MockttpBreakpointedResponse } from '../../types';
import { lazyObservablePromise } from '../../util/observable';
import { HttpExchange } from '../http/exchange';

import { AccountStore } from '../account/account-store';
import { ServerStore } from '../server-store';
import { EventsStore } from '../http/events-store';
import { getDesktopInjectedValue } from '../../services/desktop-api';

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
} from './rules-structure';
import {
    buildDefaultGroup,
    buildDefaultRules,
    buildForwardingRuleIntegration
} from './rule-definitions';
import { deserializeRules } from './rule-serialization';

export type ClientCertificate = {
    readonly pfx: ArrayBuffer,
    readonly passphrase?: string,
    readonly filename: string
};

const clientCertificateSchema = serializr.createSimpleSchema({
    passphrase: serializr.primitive(),
    filename: serializr.primitive(),
    pfx: serializr.custom(encodeBase64, decodeBase64)
});

export class RulesStore {

    constructor(
        private readonly accountStore: AccountStore,
        private readonly serverStore: ServerStore,
        private readonly eventsStore: EventsStore,
        private readonly jumpToExchange: (exchangeId: string) => void
    ) { }

    readonly initialized = lazyObservablePromise(async () => {
        await Promise.all([
            this.accountStore.initialized,
            this.serverStore.initialized,
            this.eventsStore.initialized
        ]);

        await this.loadSettings();

        const { setServerRules } = this.serverStore;

        // Set the server rules, and subscribe future rule changes to update them later.
        await new Promise((resolve) => {
            reaction(
                () => _.cloneDeep( // Clone to retain the pre-serialization definitions.
                    flattenRules(this.rules)
                    // Drop inactive or never-matching rules
                    .filter(r => r.activated && r.matchers.length),
                ),
                (rules) => {
                    resolve(setServerRules(...rules))
                },
                { fireImmediately: true }
            )
        })

        console.log('Rules store initialized');
    });

    private async loadSettings() {
        const { accountStore } = this;
        // Every time the user account data is updated from the server, consider resetting
        // paid settings to the free defaults. This ensures that they're reset on
        // logout & subscription expiration (even if that happened while the app was
        // closed), but don't get reset when the app starts with stale account data.
        observe(accountStore, 'accountDataLastUpdated', () => {
            if (!accountStore.isPaidUser) {
                this.draftWhitelistedCertificateHosts = ['localhost'];
                this.draftClientCertificateHostMap = {};
            }
        });

        // Backward compat for store data before 2020-01-28 - drop this in a month or two
        const oldData = localStorage.getItem('interception-store');
        const newData = localStorage.getItem('rules-store');
        if (oldData && !newData) {
            try {
                const data = JSON.parse(oldData);

                // Migrate data from the interception store to here:
                localStorage.setItem('rules-store', JSON.stringify(_.pick(data, [
                    'draftWhitelistedCertificateHosts',
                    'draftClientCertificateHostMap'
                ])));
            } catch (e) {
                console.log(e);
            }
        }

        // Load all persisted settings from storage
        await create()('rules-store', this);

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
    ensureDefaultRuleExists(rule: HtkMockItem) {
        const activeRulePath = findItemPath(this.rules, { id: rule.id });
        const activeRule = activeRulePath
            ? getItemAtPath(this.rules, activeRulePath) as HtkMockRule
            : undefined;

        const draftRulePath = findItemPath(this.draftRules, { id: rule.id });
        const draftRule = draftRulePath
            ? getItemAtPath(this.draftRules, draftRulePath) as HtkMockRule
            : undefined;

        if (areItemsEqual(rule, activeRule) && areItemsEqual(rule, draftRule)) {
            // Rule is already happily in place.
            return;
        }

        if (draftRulePath) {
            // The draft rule exists, and active doesn't or has changed.
            updateItemAtPath(this.draftRules, draftRulePath, rule);
            this.saveItem(draftRulePath);
            return;
        }

        // No draft rule at all: build one (creating the default rules group if necessary),
        // and save it, to update both the active & draft rules.

        let draftDefaultGroupPath = findItemPath(this.draftRules, { id: 'default-group' });
        if (!draftDefaultGroupPath) {
            // If there's no draft default rules at all, build one
            this.draftRules.items.push(buildDefaultGroup(rule));
            draftDefaultGroupPath = [this.draftRules.items.length - 1];
        } else {
            const draftDefaultGroup = getItemAtPath(this.draftRules, draftDefaultGroupPath) as HtkMockRuleGroup;
            draftDefaultGroup.items.unshift(rule);
        }

        this.saveItem(draftDefaultGroupPath.concat(0));
    }

    @action.bound
    loadSavedRules(savedData: any) {
        this.rules = deserializeRules(savedData, { rulesStore: this });
        this.resetRuleDrafts();
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
        this: RulesStore,
        eventId: string,
        getEditedEvent: (exchange: HttpExchange) => Promise<T>
    ) {
        let exchange: HttpExchange | undefined;

        // Wait until the event itself has arrived in the UI:
        yield when(() => {
            exchange = _.find(this.eventsStore.exchanges, { id: eventId });

            // Completed -> doesn't fire for initial requests -> no completed/initial req race
            return !!exchange && exchange.isCompletedRequest();
        });

        // Jump to the exchange:
        this.jumpToExchange(eventId);

        // Mark the exchange as breakpointed, and wait for an edited version.
        // UI will make it editable, add a save button, save will resolve this promise
        return (yield getEditedEvent(exchange!)) as T;
    });

}