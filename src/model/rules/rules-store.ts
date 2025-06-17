import * as _ from 'lodash';

import {
    requestSteps,
    MOCKTTP_PARAM_REF,
    PassThroughStepConnectionOptions,
    ProxySetting,
    RuleParameterReference,
    ProxySettingSource,
    webSocketSteps
} from 'mockttp';
import * as MockRTC from 'mockrtc';

import {
    observable,
    action,
    flow,
    computed,
    observe,
    when,
    reaction,
    runInAction
} from 'mobx';
import * as uuid from 'uuid/v4';
import * as serializr from 'serializr';
import { encode as encodeBase64, decode as decodeBase64 } from 'base64-arraybuffer';
import * as semver from 'semver';

import {
    HttpExchange,
    MockttpBreakpointedRequest,
    MockttpBreakpointedResponse
} from '../../types';
import { lazyObservablePromise } from '../../util/observable';
import { persist, hydrate } from '../../util/mobx-persist/persist';
import { logError } from '../../errors';

import { AccountStore } from '../account/account-store';
import { ProxyStore } from '../proxy-store';
import { getDesktopInjectedValue } from '../../services/desktop-api';
import { RTC_RULES_SUPPORTED, WEBSOCKET_RULE_RANGE } from '../../services/service-versions';

import {
    HtkRule,
    isHttpBasedRule,
    isWebSocketRule,
    isRTCRule
} from './rules';
import {
    HtkRuleGroup,
    flattenRules,
    ItemPath,
    isRuleGroup,
    getItemAtPath,
    getItemParentByPath,
    updateItemAtPath,
    deleteItemAtPath,
    findItem,
    findItemPath,
    HtkRuleRoot,
    isRuleRoot,
    HtkRuleItem,
    areItemsEqual,
} from './rules-structure';
import {
    buildDefaultGroupRules,
    buildDefaultGroupWrapper,
    buildDefaultRulesRoot,
    buildForwardingRuleIntegration,
} from './rule-creation';
import {
    serializeRules,
    deserializeRules,
    HtkRulesetSchema,
    DeserializationArgs
} from './rule-serialization';
import { migrateRuleData } from './rule-migrations';
import { ParsedCertificate } from '../crypto';

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

const reloadRules = (ruleRoot: HtkRuleRoot, rulesStore: RulesStore) => {
    return deserializeRules(serializeRules(ruleRoot), { rulesStore });
};

const dockerProxyRuleParamName = (port: number) =>
    `docker-tunnel-proxy-${port}`;

export type UpstreamProxyType =
    | 'system'
    | 'direct'
    | 'http'
    | 'https'
    | 'socks4'
    | 'socks4a'
    | 'socks5'
    | 'socks5h';

export class RulesStore {

    constructor(
        private readonly accountStore: AccountStore,
        private readonly proxyStore: ProxyStore,
        private readonly jumpToExchange: (exchangeId: string) => Promise<HttpExchange>
    ) { }

    readonly initialized = lazyObservablePromise(async () => {
        await Promise.all([
            this.accountStore.initialized,
            this.proxyStore.initialized
        ]);

        await this.loadSettings();

        const {
            setRequestRules,
            setWebSocketRules,
            setRTCRules,
            serverVersion
        } = this.proxyStore;

        // When the general config options change, reload all rules to re-inject the config
        // into all the rules that need it.
        reaction(
            () => {
                return this.activePassthroughOptions;
            },
            () => {
                this.rules = reloadRules(this.rules, this);
                this.draftRules = reloadRules(this.draftRules, this);
            }
        );

        // Reset the proxy host if the type is changed to one where no host is required
        reaction(
            () => this.upstreamProxyType,
            (type) => {
                if (type === 'direct' || type === 'system') {
                    this.upstreamProxyHost = undefined;
                }
            }
        );

        // Set the server rules, and subscribe future rule changes to update them later.
        await new Promise<void>((resolve) => {
            reaction(
                () => _.cloneDeep( // Clone to retain the pre-serialization definitions.
                    flattenRules(this.rules)
                    // Drop inactive or never-matching rules
                    .filter(r => r.activated && r.matchers.length),
                ),
                async (rules) => {
                    try {
                        await Promise.all([
                            setRequestRules(...rules.filter(isHttpBasedRule)),
                            ...(semver.satisfies(serverVersion, WEBSOCKET_RULE_RANGE)
                                ? [
                                    setWebSocketRules(...rules.filter(isWebSocketRule))
                                ] : []
                            ),
                            ...(semver.satisfies(serverVersion, RTC_RULES_SUPPORTED)
                                ? [
                                    setRTCRules(...rules.filter(isRTCRule).map(({ matchers, steps }) => ({
                                        // We skip the first matcher, which is always an unused wildcard:
                                        matchers: matchers.slice(1) as MockRTC.matchers.MatcherDefinition[],
                                        steps
                                    })))
                                ] : []
                            )
                        ]);
                        resolve();
                    } catch (e) {
                        console.log('Failed to activate stored rules', e, JSON.stringify(rules));
                        logError('Failed to activate configured ruleset');
                        alert(`Configured rules could not be activated, so were reset to default.`);

                        this.resetRulesToDefault(); // Should trigger the reaction above again, and thereby resolve().
                    }
                },
                { fireImmediately: true }
            )
        })

        console.log('Rules store initialized');
    });

    private async loadSettings() {
        const { accountStore } = this;

        // Load rule configuration settings from storage
        await hydrate({
            key: 'rules-store',
            store: this,
            dataTransform: (data: {}) => _.omit(data, 'rules'),
        });

        try {
            // Backward compatibility for the previous 'draft' data fields.
            const rawStoreData = JSON.parse(localStorage.getItem('rules-store') ?? '{}');
            runInAction(() => {
                if ('draftWhitelistedCertificateHosts' in rawStoreData) {
                    this.whitelistedCertificateHosts = rawStoreData.draftWhitelistedCertificateHosts;
                }
                if ('draftClientCertificateHostMap' in rawStoreData) {
                    this.clientCertificateHostMap = rawStoreData.draftClientCertificateHostMap;
                }
            });
        } catch (e) {
            logError(e);
        }

        if (accountStore.mightBePaidUser) {
            // Load the actual rules from storage (separately, so deserialization can use settings loaded above)
            await hydrate({
                key: 'rules-store',
                store: this,
                dataTransform: (data: { rules: any }) => ({
                    rules: migrateRuleData(data.rules)
                }),
                customArgs: { rulesStore: this } as DeserializationArgs
            }).catch((err) => {
                console.log('Failed to load last-run rules',
                    err,
                    // Log the full rule data for debugging:
                    JSON.parse(localStorage.getItem('rules-store') ?? '{}')?.rules
                );

                logError(err);
                alert(`Could not load rules from last run.\n\n${err}`);
                // We then continue, which resets the rules exactly as if this was the user's first run.
            });

            if (!this.rules) {
                // If rules are somehow undefined (not sure, but seems it can happen, maybe odd data?) reset them:
                this.resetRulesToDefault();
            } else {
                // Drafts are never persisted, so always need resetting to match the just-loaded data:
                this.resetRuleDrafts();

                // Recreate default rules on startup, even if we're restoring persisted rules
                const defaultRules = buildDefaultGroupRules(this, this.proxyStore);
                defaultRules.forEach(r => this.ensureRuleExists(r));
            }
        } else {
            // For free users, reset rules to default (separately, so defaults can use settings loaded above)
            this.resetRulesToDefault();
        }

        // Support injection of a default forwarding rule by the desktop app, for integrations
        this.ensureRuleDoesNotExist('default-forwarding-rule');
        getDesktopInjectedValue('httpToolkitForwardingDefault').then(action((forwardingConfig: string) => {
            const [sourceHost, targetHost] = forwardingConfig.split('|');
            const forwardingRule = buildForwardingRuleIntegration(sourceHost, targetHost, this);
            this.ensureRuleExists(forwardingRule);
        }));

        if ((this.upstreamProxyType as string) === 'socks') {
            runInAction(() => {
                // Backward compat from when we only supported generic 'socks' proxies, not individual types.
                this.upstreamProxyType = 'socks5h';
            });
        }

        // Every time the user account data is updated from the server, consider resetting
        // paid settings to the free defaults. This ensures that they're reset on
        // logout & subscription expiration (even if that happened while the app was
        // closed), but don't get reset when the app starts with stale account data.
        observe(accountStore, 'accountDataLastUpdated', () => {
            if (!accountStore.isPaidUser) {
                this.whitelistedCertificateHosts = ['localhost'];
                this.clientCertificateHostMap = {};
                this.upstreamProxyType = 'system';
                this.upstreamNoProxyHosts = [];

                // We don't reset the rules on expiry/log out, e.g. to remove paid rule types, but
                // they won't persist, so they'll disappear next time the app is started up.
            }
        });
    }

    // This is live updated as the corresponding fields change, and so the resulting rules are
    // updated immediately as this changes too.
    @computed.struct
    get activePassthroughOptions(): PassThroughStepConnectionOptions {
        const options: PassThroughStepConnectionOptions = { // Check the type to catch changes
            ignoreHostHttpsErrors: this.whitelistedCertificateHosts,
            additionalTrustedCAs: this.additionalCaCertificates.map((cert) => ({ cert: cert.rawPEM })),
            clientCertificateHostMap: _.mapValues(this.clientCertificateHostMap, (cert) => ({
                pfx: Buffer.from(cert.pfx),
                passphrase: cert.passphrase
            })),
            proxyConfig: this.proxyConfig,
            lookupOptions: this.proxyStore.dnsServers.length
                ? { servers: this.proxyStore.dnsServers }
                : undefined,
            simulateConnectionErrors: true
        };

        // Clone to ensure we touch & subscribe to everything here
        return _.cloneDeep(options);
    }

    @persist @observable
    upstreamProxyType: UpstreamProxyType = 'system';

    @persist @observable
    upstreamProxyHost: string | undefined = undefined;

    @persist('list') @observable
    upstreamNoProxyHosts: string[] = [];

    @computed
    get effectiveSystemProxyConfig(): ProxySetting | 'ignored' | 'unparseable' | undefined {
        const { systemProxyConfig } = this.proxyStore;

        if (!systemProxyConfig) return undefined;

        const { proxyUrl } = systemProxyConfig;
        try {
            const parsedProxyUrl = new URL(proxyUrl);
            const { hostname } = parsedProxyUrl;
            if (hostname === 'localhost' || hostname.startsWith('127.0.0')) {
                // Localhost proxy config is ignored
                return 'ignored';
            } else {
                return {
                    ...systemProxyConfig,
                    additionalTrustedCAs: this.additionalCaCertificates.map((cert) => ({ cert: cert.rawPEM }))
                };
            }
        } catch (e) {
            console.log("Could not parse proxy", proxyUrl);
            logError(e);
            return 'unparseable';
        }
    }

    @computed.struct
    get userProxyConfig(): ProxySetting | undefined {
        if (this.upstreamProxyType === 'direct') {
            return undefined;
        } else if (this.upstreamProxyType === 'system') {
            const systemConfig = this.effectiveSystemProxyConfig;

            if (!systemConfig || _.isString(systemConfig)) return undefined;
            else return systemConfig;
        } else {
            return {
                proxyUrl: `${this.upstreamProxyType}://${this.upstreamProxyHost!}`,
                noProxy: this.upstreamNoProxyHosts,
                additionalTrustedCAs: this.additionalCaCertificates.map((cert) => ({ cert: cert.rawPEM }))
            };
        }
    }

    @computed.struct
    get proxyConfig():
        | ProxySetting
        | RuleParameterReference<ProxySettingSource>
        | Array<ProxySetting | RuleParameterReference<ProxySettingSource>>
        | undefined
    {
        const { userProxyConfig } = this;
        const { httpProxyPort } = this.proxyStore;

        if (this.proxyStore.ruleParameterKeys.includes(dockerProxyRuleParamName(httpProxyPort))) {
            const dockerProxyConfig = { [MOCKTTP_PARAM_REF]: dockerProxyRuleParamName(httpProxyPort) };

            return userProxyConfig
                ? [dockerProxyConfig, userProxyConfig]
                : dockerProxyConfig;
        } else {
            return userProxyConfig;
        }
    }

    // The currently active list
    @persist('list') @observable
    whitelistedCertificateHosts: string[] = ['localhost'];

    // The currently active client certificates
    @persist('map', clientCertificateSchema) @observable
    clientCertificateHostMap: { [host: string]: ClientCertificate } = {};

    // The currently active additional CA certificates
    @persist('list') @observable
    additionalCaCertificates: Array<ParsedCertificate> = [];

    @persist('object', HtkRulesetSchema) @observable
    rules!: HtkRuleRoot;

    @observable
    draftRules!: HtkRuleRoot;

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
        this.rules = buildDefaultRulesRoot(this, this.proxyStore);
        this.resetRuleDrafts();
    }

    @computed
    get areSomeRulesUnsaved() {
        return !_.isEqualWith(this.draftRules, this.rules, areItemsEqual);
    }

    @computed
    get areSomeRulesNonDefault() {
        const defaultRules = buildDefaultRulesRoot(this, this.proxyStore);
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
        let targetDraftParent = findItem(draftRules, { id: activeParent.id }) as HtkRuleGroup;

        if (!targetDraftParent) {
            let missingParents = [activeParent];
            // Loop up until we find a parent that _does_ exist, and then insert all
            // missing parents from that point.
            while (missingParents.length) {
                const missingParentsActivePath = activeRulePath.slice(0, -missingParents.length);
                const nextActiveParent = getItemParentByPath(activeRules, missingParentsActivePath);

                const targetDraftParentParent = findItem(draftRules, { id: nextActiveParent.id }) as HtkRuleGroup;

                if (targetDraftParentParent) {
                    targetDraftParent = missingParents.reduce(({ draftParent, activeParent }, missingGroup) => {
                        const newGroup = observable(_.clone({ ...missingGroup, items: [] }));

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
                this.deleteDraftItem(findItemPath(this.draftRules, { id: currentDraftParent.id })!);
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

        let targetActiveParent = findItem(activeRules, { id: draftParent.id }) as HtkRuleGroup;
        if (!targetActiveParent) {
            targetActiveParent = this.saveItem(draftItemPath.slice(0, -1)) as HtkRuleGroup;
        }

        const id = draftItem.id;
        const activeItemPath = findItemPath(activeRules, { id });

        const updatedItem = observable(_.cloneDeep(_.omit(draftItem, 'items')) as HtkRuleItem);

        // When saving a single group, save the group itself, don't change the contents
        if (isRuleGroup(draftItem)) {
            if (activeItemPath) {
                const activeItem = getItemAtPath(activeRules, activeItemPath) as HtkRuleGroup;
                (updatedItem as HtkRuleGroup).items = _.cloneDeep(activeItem.items);
            } else {
                (updatedItem as HtkRuleGroup).items = [];
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
    addDraftItem(draftItem: HtkRuleItem, targetPath?: ItemPath) {
        if (!targetPath) {
            // By default, we just append them at the top level
            this.draftRules.items.unshift(draftItem);
            return;
        }

        // Alternatively, we want to insert them at a specific position.
        const parent = getItemParentByPath(this.draftRules, targetPath);
        const childPosition = _.last(targetPath)!;
        parent.items.splice(childPosition, 0, draftItem);
    }

    @action.bound
    deleteDraftItem(draftItemPath: ItemPath) {
        deleteItemAtPath(this.draftRules, draftItemPath);
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
            this.deleteDraftItem(findItemPath(this.draftRules, { id: currentParent.id })!);
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
        this.deleteDraftItem(sourcePath);
    }

    @action.bound
    updateGroupTitle(groupId: string, newTitle: string) {
        const draftGroup = findItem(this.draftRules, { id: groupId }) as HtkRuleGroup;
        const activeGroup = findItem(this.rules, { id: groupId }) as (
            HtkRuleGroup | undefined
        );

        draftGroup.title = newTitle;
        if (activeGroup) activeGroup.title = newTitle;
    }

    @action.bound
    ensureRuleExists(rule: HtkRuleItem) {
        const activeRulePath = findItemPath(this.rules, { id: rule.id });
        const activeRule = activeRulePath
            ? getItemAtPath(this.rules, activeRulePath) as HtkRule
            : undefined;

        const draftRulePath = findItemPath(this.draftRules, { id: rule.id });
        const draftRule = draftRulePath
            ? getItemAtPath(this.draftRules, draftRulePath) as HtkRule
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
            this.draftRules.items.push(buildDefaultGroupWrapper([rule]));
            draftDefaultGroupPath = [this.draftRules.items.length - 1];
        } else {
            const draftDefaultGroup = getItemAtPath(this.draftRules, draftDefaultGroupPath) as HtkRuleGroup;
            draftDefaultGroup.items.unshift(rule);
        }

        this.saveItem(draftDefaultGroupPath.concat(0));
    }

    @action.bound
    ensureRuleDoesNotExist(ruleId: string) {
        const activeRulePath = findItemPath(this.rules, { id: ruleId });
        if (activeRulePath) {
            deleteItemAtPath(this.rules, activeRulePath);
        }

        const draftRulePath = findItemPath(this.draftRules, { id: ruleId });
        if (draftRulePath) {
            deleteItemAtPath(this.draftRules, draftRulePath);
        }
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
        // Jump to the exchange, once the request is completed:
        const exchange: HttpExchange = yield this.jumpToExchange(eventId);

        // Mark the exchange as breakpointed, and wait for an edited version.
        // UI will make it editable, add a save button, save will resolve this promise
        return (yield getEditedEvent(exchange!)) as T;
    });

}