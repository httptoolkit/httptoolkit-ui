import * as _ from 'lodash';
import { toJS } from 'mobx';
import { completionCheckers } from 'mockttp';
import * as serializr from 'serializr';

import { hasSerializrSchema, serializeAsTag } from '../serialization';

import { RulesStore } from './rules-store';
import { MatcherLookup, HandlerLookup } from './rules';
import {
    HtkMockRule,
    HtkMockItem,
    HtkMockRuleRoot,
    isRuleGroup,
    HtkMockRuleGroup
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
    // uiType allows us to override deserialization for UI representations only,
    // but keep the same serialization type for real Mockttp rules.
    const clazz = lookup[data.uiType || data.type];

    if (hasSerializrSchema(clazz)) {
        return serializr.deserialize(clazz, data, () => {}, args);
    } else {
        return _.create(clazz.prototype, data);
    }
}

const MockRuleSerializer = serializr.custom(
    (rule: HtkMockRule): HtkMockRule => {
        const data = _.cloneDeep(toJS(rule));

        // Allow matchers & handlers to override default serialization using serializr
        data.matchers = data.matchers.map((matcher) => {
            if (hasSerializrSchema(matcher)) {
                return serializr.serialize(matcher);
            } else {
                return matcher;
            }
        });

        if (hasSerializrSchema(data.handler)) {
            data.handler = serializr.serialize(data.handler);
        }

        if (data.completionChecker && hasSerializrSchema(data.completionChecker)) {
            data.completionChecker = serializr.serialize(data.completionChecker);
        }

        return data;
    },
    (data: HtkMockRule, context: { args: DeserializationArgs }) => {
        return {
            id: data.id,
            activated: data.activated,
            matchers: data.matchers.map((m) =>
                deserializeByType(m, MatcherLookup, context.args)
            ),
            handler: deserializeByType(data.handler, HandlerLookup, context.args),
            completionChecker: data.completionChecker &&
                deserializeByType(
                    data.completionChecker,
                    completionCheckers.CompletionCheckerLookup,
                    context.args
                )
        };
    }
);

const MockItemSerializer: serializr.PropSchema = serializr.custom(
    (item: HtkMockItem) => {
        if (isRuleGroup(item)) {
            return serializr.serialize(MockRuleGroupSchema, item);
        } else {
            return MockRuleSerializer.serializer(item);
        }
    },
    (data: HtkMockItem, context: any, oldValue: any, done: (err: any, result: any) => any) => {
        if (isRuleGroup(data)) {
            const group = serializr.deserialize(MockRuleGroupSchema, data, done, context.args);
            group.collapsed = true; // Groups always start collapsed when unpersisted/imported.
            return group;
        } else {
            return MockRuleSerializer.deserializer(data, done, context, oldValue);
        }
    }
);

const MockRuleGroupSchema = serializr.createSimpleSchema<HtkMockRuleGroup>({
    id: serializr.primitive(),
    title: serializr.primitive(),
    items: serializr.list(MockItemSerializer)
});

interface MockRuleset extends HtkMockRuleRoot {
    version: undefined;
}

export const MockRulesetSchema = serializr.createSimpleSchema<MockRuleset>({
    id: serializr.primitive(),
    title: serializr.primitive(),
    version: serializeAsTag(() => undefined), // All compatible, so we don't version yet, but we _could_.
    isRoot: serializr.optional(serializr.primitive()),
    items: serializr.list(MockItemSerializer)
});

export const serializeRules = (rules: HtkMockRuleRoot): MockRuleset => {
    return serializr.serialize(MockRulesetSchema, rules);
}

export const deserializeRules = (data: any, args: DeserializationArgs): HtkMockRuleRoot => {
    return (
        serializr.deserialize(MockRulesetSchema, migrateRuleData(data), undefined, args)
    ) as HtkMockRuleRoot;
}