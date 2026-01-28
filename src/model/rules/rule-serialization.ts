import * as _ from 'lodash';
import { toJS } from 'mobx';
import { completionCheckers } from 'mockttp';
import * as serializr from 'serializr';

import { hasSerializrSchema, serializeAsTag } from '../serialization';

import { RulesStore } from './rules-store';
import { HtkRule, MatcherLookup, StepLookup, getRulePartKey, Step } from './rules';
import {
    HtkRuleItem,
    HtkRuleRoot,
    isRuleGroup,
    HtkRuleGroup
} from './rules-structure';
import { migrateRuleData } from './rule-migrations';

export type DeserializationArgs = {
    rulesStore: RulesStore
};

const deserializeByType = <T extends { type: string, uiType?: string }>(
    data: T,
    lookup: _.Dictionary<any>,
    args: DeserializationArgs
) => {
    const typeKey = getRulePartKey(data);
    const clazz = lookup[typeKey];

    if (!clazz) throw new Error(`Can't load unrecognized rule type: ${typeKey}`);

    if (hasSerializrSchema(clazz)) {
        return serializr.deserialize(clazz, data, () => {}, args);
    } else {
        return _.create(clazz.prototype, data);
    }
}

const RuleSerializer = serializr.custom(
    (rule: HtkRule): HtkRule => {
        const data = _.cloneDeep(toJS(rule));

        // Allow matchers & steps to override default serialization using serializr
        data.matchers = data.matchers.map((matcher) => {
            if (hasSerializrSchema(matcher)) {
                return serializr.serialize(matcher);
            } else {
                return matcher;
            }
        });

        data.steps = data.steps.map((step) => {
            if (hasSerializrSchema(step)) {
                return serializr.serialize(step);
            } else {
                return step;
            }
        });

        if ('completionChecker' in data && hasSerializrSchema(data.completionChecker)) {
            data.completionChecker = serializr.serialize(data.completionChecker);
        }

        return data;
    },
    (data: HtkRule & { handler?: Step }, context: { args: DeserializationArgs }) => {
        return {
            id: data.id,
            type: data.type,
            title: data.title,
            activated: data.activated,
            priority: 'priority' in data ? data.priority : undefined,
            matchers: data.matchers.map((m) =>
                deserializeByType(m, MatcherLookup, context.args)
            ),
            ...(!!data.handler
                ? { // Fallback for old 'handler' exports from before Mockttp v4:
                    steps: [deserializeByType(data.handler, StepLookup, context.args)]
                }
                : {
                    steps: data.steps.map((s) => deserializeByType(s, StepLookup, context.args))
                }
            ),
            completionChecker: 'completionChecker' in data &&
                deserializeByType(
                    data.completionChecker,
                    completionCheckers.CompletionCheckerLookup,
                    context.args
                )
        };
    }
);

const RuleItemSerializer: serializr.PropSchema = serializr.custom(
    (item: HtkRuleItem) => {
        if (isRuleGroup(item)) {
            return serializr.serialize(RuleGroupSchema, item);
        } else {
            return RuleSerializer.serializer(item);
        }
    },
    (data: HtkRuleItem, context: any, oldValue: any, done: (err: any, result: any) => any) => {
        if (isRuleGroup(data)) {
            const group = serializr.deserialize(RuleGroupSchema, data, done, context.args);
            group.collapsed = true; // Groups always start collapsed when unpersisted/imported.
            return group;
        } else {
            return RuleSerializer.deserializer(data, done, context, oldValue);
        }
    }
);

const RuleGroupSchema = serializr.createSimpleSchema<HtkRuleGroup>({
    id: serializr.primitive(),
    title: serializr.primitive(),
    items: serializr.list(RuleItemSerializer)
});

interface HtkRuleset extends HtkRuleRoot {
    version: undefined;
}

export const HtkRulesetSchema = serializr.createSimpleSchema<HtkRuleset>({
    id: serializr.primitive(),
    title: serializr.primitive(),
    version: serializeAsTag(() => undefined), // All compatible, so we don't version yet, but we _could_.
    isRoot: serializr.optional(serializr.primitive()),
    items: serializr.list(RuleItemSerializer)
});

export const serializeRules = (rules: HtkRuleRoot): HtkRuleset => {
    return serializr.serialize(HtkRulesetSchema, rules);
}

export const deserializeRules = (data: any, args: DeserializationArgs): HtkRuleRoot => {
    return (
        serializr.deserialize(HtkRulesetSchema, migrateRuleData(data), undefined, args)
    ) as HtkRuleRoot;
}

export const SERIALIZED_RULES_MIME_TYPE = 'application/htkrules+json;charset=utf-8';