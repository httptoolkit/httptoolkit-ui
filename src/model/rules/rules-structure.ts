import * as _ from 'lodash';
import * as uuid from 'uuid/v4'
import { observable } from 'mobx';

import { HtkRule } from './rules';

export type HtkRuleItem =
    | HtkRule
    | HtkRuleGroup
    | HtkRuleRoot;

export type HtkRuleGroup = {
    id: string;
    title: string;
    items: HtkRuleItem[];
    collapsed?: boolean;
};

export interface HtkRuleRoot extends HtkRuleGroup {
    id: 'root';
    title: 'HTTP Toolkit Rules';
    isRoot: true;
    items: HtkRuleItem[];
}

export type ItemPath = number[];

export function isRuleGroup(item: HtkRuleItem | undefined): item is HtkRuleGroup {
    return _.isObject(item) && 'items' in (item || {});
};

export function isRuleRoot(item: HtkRuleItem): item is HtkRuleRoot {
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

export function getItemParentByPath(rules: HtkRuleGroup, path: ItemPath) {
    return getItemAtPath(rules, path.slice(0, -1)) as HtkRuleGroup;
}

export function getItemAtPath(rules: HtkRuleGroup, path: ItemPath): HtkRuleItem {
    return path.reduce<HtkRuleItem>((result, step, index) => {
        if (!isRuleGroup(result)) {
            throw new Error(`Invalid path ${path} at step #${index}, found ${result}`);
        }
        return result.items[step];
    }, rules);
};

export function updateItemAtPath(
    rules: HtkRuleGroup,
    path: ItemPath,
    newItem: HtkRuleItem
) {
    const parentPath = path.slice(0, -1);
    const childIndex = _.last(path)!;

    const parentItems = parentPath.length
        ? getItemAtPath(rules, parentPath) as HtkRuleGroup
        : rules;

    parentItems.items[childIndex] = newItem;
    return parentItems;
};

export function deleteItemAtPath(
    rules: HtkRuleGroup,
    path: ItemPath
) {
    const parent = getItemParentByPath(rules, path);
    const itemIndex = _.last(path)!;
    parent.items.splice(itemIndex, 1);

    // If the parent is empty, delete them too (recursively, but not the root)
    if (parent.items.length === 0 && !isRuleRoot(parent)) {
        deleteItemAtPath(rules, path.slice(0, -1));
    }
}

export function findItem(
    rules: HtkRuleGroup,
    match: ((value: HtkRuleItem) => boolean) | Partial<HtkRuleItem>
): HtkRuleItem | undefined {
    if (_.isMatch(rules, match)) return rules;

    return _.reduce(rules.items, (result: HtkRuleItem | undefined, item: HtkRuleItem) => {
        if (result) return result;

        if (isRuleGroup(item)) {
            return findItem(item, match);
        } else if (_.isMatch(item, match)) {
            return item;
        }
    }, undefined);
};

export function findItemPath(
    rules: HtkRuleGroup,
    match: ((value: HtkRuleItem) => boolean) | Partial<HtkRuleItem>,
    currentPath: ItemPath = []
): ItemPath | undefined {
    if (_.isMatch(rules, match)) return currentPath;

    return _.reduce(rules.items, (result: ItemPath | undefined, item: HtkRuleItem, index: number) => {
        if (result) return result;

        if (isRuleGroup(item)) {
            return findItemPath(item, match, currentPath.concat(index));
        } else if (_.isMatch(item, match)) {
            return currentPath.concat(index) as ItemPath;
        }
    }, undefined);
};

export const flattenRules = (rules: HtkRuleGroup) => mapRules(rules, r => r);

export function mapRules<R>(
    rules: HtkRuleGroup,
    fn: (rule: HtkRule, path: ItemPath, index: number) => R,
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
                [fn(item, currentPath.concat(index) as ItemPath, totalIndex)]
            );
        }
    }, []);
};

export function cloneItem<I extends HtkRuleGroup | HtkRule>(item: I): I {
    if (isRuleGroup(item)) {
        return cloneRuleGroup<I & HtkRuleGroup>(item);
    } else {
        return cloneRule(item as I & HtkRule);
    }
}

export function cloneRule<R extends HtkRule>(rule: R): R {
    return observable({
        ...rule, // All handler/matcher/checker state is immutable
        matchers: [...rule.matchers], // Except the matcher array itself
        id: uuid() // And we need a different rule id
    });
};

export function cloneRuleGroup<G extends HtkRuleGroup>(group: HtkRuleGroup): G {
    return {
        ...group,
        items: group.items.map(i => cloneItem(i)),
        collapsed: true,
        id: uuid()
    } as G;
}

export const areItemsEqual = (a: HtkRuleItem | undefined, b: HtkRuleItem | undefined) => {
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

const areGroupsEqual = (a: HtkRuleGroup, b: HtkRuleGroup) => {
    return a.id === b.id &&
        a.title === b.title &&
        _.isEqualWith(a.items, b.items, areItemsEqual);
};

// Rules, or any components within them, can use this to override equality checks at
// a certain point in the tree. Useful e.g. in transforms, where undefined values are
// meaningful differences, so we need different logic.
export const CUSTOM_RULE_EQUALS = Symbol('custom-rule-is-equals');

// A more flexible _.isEqual check. Considers source-equal functions to be
// equal, and treats undefined properties as missing.
const areRulesEqual = (a: any, b: any): boolean | undefined => {
    if (a && b && a[CUSTOM_RULE_EQUALS] && a[CUSTOM_RULE_EQUALS] === b[CUSTOM_RULE_EQUALS]) {
        const isEqual = a[CUSTOM_RULE_EQUALS];
        return isEqual(a, b);
    }

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