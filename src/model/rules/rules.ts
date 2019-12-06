import * as _ from 'lodash';
import * as uuid from 'uuid/v4';
import { observable } from 'mobx';

import {
    handlers,
    matchers,
    completionCheckers,
    MockRuleData,
} from 'mockttp';

import { Omit } from '../../types';
import { ActivatedStore, InterceptionStore } from '../interception-store';

import * as amIUsingHtml from '../../amiusing.html';
import {
    MethodMatchers,
    WildcardMatcher,
    StaticResponseHandler,
    AmIUsingMatcher,
    DefaultWildcardMatcher,
    ForwardToHostHandler,
    PassThroughHandler,
    RequestBreakpointHandler,
    ResponseBreakpointHandler,
    RequestAndResponseBreakpointHandler,
    TimeoutHandler,
    CloseConnectionHandler,
    FromFileResponseHandler
} from './rule-definitions';

export type HtkMockItem = HtkMockRule | HtkMockRuleGroup | HtkMockRuleRoot;

export type HtkMockRule = Omit<MockRuleData, 'matchers'> & {
    id: string;
    activated: boolean;
    matchers: Array<Matcher> & { 0?: InitialMatcher };
    handler: Handler;
};

export type HtkMockRuleGroup = {
    id: string;
    title: string;
    items: HtkMockItem[];
};

export type HtkMockRuleRoot = HtkMockRuleGroup & {
    id: 'root';
    title: 'HTTP Toolkit Rules';
    isRoot: true;
    items: HtkMockItem[];
}

export type ItemPath = number[];

export function isRuleGroup(item: HtkMockItem): item is HtkMockRuleGroup {
    return _.isObject(item) && 'items' in item;
};

export function isRuleRoot(item: HtkMockItem): item is HtkMockRuleRoot {
    return isRuleGroup(item) && 'isRoot' in item && item.isRoot === true;
}

// 0 means equal, positive means a < b, negative means b < a
export function comparePaths(pathA: ItemPath, pathB: ItemPath): number {
    let index = 0;

    while (pathA[index] !== undefined && pathB[index] !== undefined) {
        const diff = pathB[index] - pathA[index];
        if (diff !== 0) return diff;
        index += 1;
    }

    if (pathA[index] !== undefined) {
        return -1; // B shorter than A, so comes first
    }

    if (pathB[index] !== undefined) {
        return 1; // A shorter than B, so comes first
    }

    // Same length, same values, equal
    return 0;
}

export function getItemParentByPath(rules: HtkMockRuleGroup, path: ItemPath) {
    return getItemAtPath(rules, path.slice(0, -1)) as HtkMockRuleGroup;
}

export function getItemAtPath(rules: HtkMockRuleGroup, path: ItemPath): HtkMockItem {
    return path.reduce<HtkMockItem>((result, step, index) => {
        if (!isRuleGroup(result)) {
            throw new Error(`Invalid path ${path} at step #${index}, found ${result}`);
        }
        return result.items[step];
    }, rules);
};

export function updateItemAtPath(
    rules: HtkMockRuleGroup,
    path: ItemPath,
    newItem: HtkMockItem
) {
    const parentPath = path.slice(0, -1);
    const childIndex = _.last(path)!;

    const parentItems = parentPath.length
        ? getItemAtPath(rules, parentPath) as HtkMockRuleGroup
        : rules;

    parentItems.items[childIndex] = newItem;
    return parentItems;
};

export function findItem(
    rules: HtkMockRuleGroup,
    match: ((value: HtkMockItem) => boolean) | Partial<HtkMockItem>
): HtkMockItem | undefined {
    if (_.isMatch(rules, match)) return rules;

    return _.reduce(rules.items, (result: HtkMockItem | undefined, item: HtkMockItem) => {
        if (result) return result;

        if (isRuleGroup(item)) {
            return findItem(item, match);
        } else if (_.isMatch(item, match)) {
            return item;
        }
    }, undefined);
};

export function findItemPath(
    rules: HtkMockRuleGroup,
    match: ((value: HtkMockItem) => boolean) | Partial<HtkMockItem>,
    currentPath: ItemPath = []
): ItemPath | undefined {
    if (_.isMatch(rules, match)) return currentPath;

    return _.reduce(rules.items, (result: ItemPath | undefined, item: HtkMockItem, index: number) => {
        if (result) return result;

        if (isRuleGroup(item)) {
            return findItemPath(item, match, currentPath.concat(index));
        } else if (_.isMatch(item, match)) {
            return currentPath.concat(index) as ItemPath;
        }
    }, undefined);
};

export const flattenRules = (rules: HtkMockRuleGroup) => mapRules(rules, r => r);

export function mapRules<R>(
    rules: HtkMockRuleGroup,
    fn: (rule: HtkMockRule, path: ItemPath, index: number) => R,
    currentPath: number[] = [],
    currentIndex = 0
): Array<R> {
    return rules.items.reduce<R[]>((result, item, index: number) => {
        const totalIndex = currentIndex + index;
        if (isRuleGroup(item)) {
            return result.concat(
                mapRules(item, fn, currentPath.concat(index), totalIndex)
            );
        } else {
            return result.concat(
                fn(item, currentPath.concat(index) as ItemPath, totalIndex)
            );
        }
    }, []);
};

// Define maps to/from matcher keys to matcher classes, and
// types for the matchers & classes themselves; both the built-in
// ones and our own extra additions & overrides.
export const MatcherLookup = Object.assign(
    {},
    matchers.MatcherLookup,
    MethodMatchers,
    {
        // Replace the built-in wildcard matcher with our own:
        wildcard: WildcardMatcher,
        // Add special types for our built-in matcher explanation overrides:
        'default-wildcard': DefaultWildcardMatcher,
        'am-i-using': AmIUsingMatcher
    }

);

export type MatcherClassKey = keyof typeof MatcherLookup;
export type MatcherClass = typeof MatcherLookup[MatcherClassKey];
export type Matcher = InstanceType<MatcherClass>;

export const MatcherKeys = new Map<MatcherClass, MatcherClassKey>(
    Object.entries(MatcherLookup)
    .map(
        ([key, matcher]) => [matcher, key]
    ) as Array<[MatcherClass, MatcherClassKey]>
);

// Define maps to/from handler keys to handler classes, and
// types for the handlers & classes themselves; both the built-in
// ones and our own extra additions & overrides.
export const HandlerLookup = Object.assign(
    {},
    handlers.HandlerLookup as Omit<typeof handlers.HandlerLookup, 'passthrough'>,
    {
        'passthrough': PassThroughHandler,
        'simple': StaticResponseHandler,
        'file': FromFileResponseHandler,
        'forward-to-host': ForwardToHostHandler,
        'request-breakpoint': RequestBreakpointHandler,
        'response-breakpoint': ResponseBreakpointHandler,
        'request-and-response-breakpoint': RequestAndResponseBreakpointHandler
    }
);

const PaidHandlerClasses: HandlerClass[] = [
    StaticResponseHandler,
    FromFileResponseHandler,
    ForwardToHostHandler,
    TimeoutHandler,
    CloseConnectionHandler
];

export const isPaidHandler = (handler: Handler) => {
    return _.some(PaidHandlerClasses, (cls) => handler instanceof cls);
}

export const isPaidHandlerClass = (handlerClass: HandlerClass) => {
    return PaidHandlerClasses.includes(handlerClass);
}

export type HandlerClassKey = keyof typeof HandlerLookup;
export type HandlerClass = typeof HandlerLookup[HandlerClassKey];
export type Handler = InstanceType<HandlerClass>;

export const HandlerKeys = new Map<HandlerClass, HandlerClassKey>(
    Object.entries(HandlerLookup)
    .map(
        ([key, handler]) => [handler, key]
    ) as Array<[HandlerClass, HandlerClassKey]>
);

export function getNewRule(interceptionStore: ActivatedStore): HtkMockRule {
    return observable({
        id: uuid(),
        activated: true,
        matchers: [ ],
        completionChecker: new completionCheckers.Always(),
        handler: new PassThroughHandler(interceptionStore)
    });
}

export const InitialMatcherClasses = [
    WildcardMatcher,
    ...Object.values(MethodMatchers)
];
export type InitialMatcherClass = typeof InitialMatcherClasses[0];
export type InitialMatcher = InstanceType<InitialMatcherClass>;

export const buildDefaultRules = (interceptionStore: InterceptionStore) => ({
    id: 'root',
    title: 'HTTP Toolkit Rules',
    isRoot: true,
    items: [
        {
            id: 'default-group',
            title: "Default rules",
            collapsed: true,
            items: [
                // Respond to amiusing.httptoolkit.tech with an emphatic YES
                {
                    id: 'default-amiusing',
                    activated: true,
                    matchers: [
                        new MethodMatchers.GET(),
                        new AmIUsingMatcher()
                    ],
                    completionChecker: new completionCheckers.Always(),
                    handler: new StaticResponseHandler(200, undefined, amIUsingHtml, {
                        'content-type': 'text/html',
                        'httptoolkit-active': 'true'
                    })
                },

                // Pass through all other traffic to the real target
                {
                    id: 'default-wildcard',
                    activated: true,
                    matchers: [new DefaultWildcardMatcher()],
                    completionChecker: new completionCheckers.Always(),
                    handler: new PassThroughHandler(interceptionStore)
                }
            ]
        }
    ]
} as HtkMockRuleRoot);

export const buildForwardingRuleIntegration = (
    sourceHost: string,
    targetHost: string,
    interceptionStore: InterceptionStore
): HtkMockRule => ({
    id: 'default-forwarding-rule',
    activated: true,
    matchers: [
        new WildcardMatcher(),
        new matchers.HostMatcher(sourceHost)
    ],
    completionChecker: new completionCheckers.Always(),
    handler: new ForwardToHostHandler(targetHost, true, interceptionStore)
});

export const areItemsEqual = (a: HtkMockItem, b: HtkMockItem) => {
    if (isRuleGroup(a)) {
        if (isRuleGroup(b)) {
            return areGroupsEqual(a, b);
        } else {
            return false;
        }
    } else {
        if (isRuleGroup(b)) {
            return false;
        } else {
            return areRulesEqual(a, b);
        }
    }
};

const areGroupsEqual = (a: HtkMockRuleGroup, b: HtkMockRuleGroup) => {
    return a.id === b.id &&
        a.title === b.title &&
        _.isEqualWith(a.items, b.items, areItemsEqual);
};

// A more flexible _.isEqual check. Considers source-equal functions to be
// equal, and treats undefined properties as missing.
const areRulesEqual = (a: any, b: any): boolean | undefined => {
    // Assume that all function props (e.g. beforeRequest, callbacks)
    // are equivalent if they're source-equivalent.
    // Not a 100% safe guarantee, but should usually be true.
    if (_.isFunction(a) && _.isFunction(b)) {
        return a.toString() === b.toString();
    }

    // For objects with undefined props, pretend those props don't exist:
    if (
        _.isObject(a) && _.isObject(b) && (
            Object.values(a).includes(undefined) ||
            Object.values(b).includes(undefined)
        )
    ) {
        return _.isEqualWith(
            _.omitBy(a, (value) => value === undefined),
            _.omitBy(b, (value) => value === undefined),
            areRulesEqual
        );
    }

    // Return undefined -> use standard rules
}