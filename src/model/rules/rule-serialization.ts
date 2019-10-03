import * as _ from 'lodash';
import { toJS } from 'mobx';
import { completionCheckers } from 'mockttp';
import * as serializr from 'serializr';

import { InterceptionStore } from '../interception-store';
import { HtkMockRule, MatcherLookup, HandlerLookup } from './rules';
import { migrateRules } from './rule-migrations';

export type DeserializationArgs = {
    interceptionStore: InterceptionStore
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

const hasSerializrSchema = (obj: any) => !!serializr.getDefaultModelSchema(obj);

export const serializeAsTag = (getTag: (value: any) => any) =>
    serializr.custom(
        getTag,
        () => serializr.SKIP
    );

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

interface MockRuleset {
    rules: HtkMockRule[];
}

const MockRulesetSchema = serializr.createSimpleSchema<MockRuleset>({
    rules: serializr.list(MockRuleSerializer)
});

export const serializeRules = (rules: HtkMockRule[]): MockRuleset => {
    return serializr.serialize(MockRulesetSchema, { rules: rules });
}

export const deserializeRules = (data: any, args: DeserializationArgs): HtkMockRule[] => {
    return (
        serializr.deserialize(MockRulesetSchema, migrateRules(data), undefined, args)
    ).rules;
}