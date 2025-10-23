import * as _ from 'lodash';
import {
    RequestRuleData,
    Method,
    matchers as httpMatchers,
    requestSteps as httpSteps,
    completionCheckers
} from 'mockttp';
import * as serializr from 'serializr';

import { MockttpSerializedBuffer } from '../../../types';
import { byteLength, isSerializedBuffer } from '../../../util/buffer';

import { MethodName, MethodNames } from '../../http/methods';
import { serializeAsTag, serializeBuffer, serializeWithUndefineds } from '../../serialization';
import { RulesStore } from '../rules-store';
import { CUSTOM_RULE_EQUALS } from '../rules-structure';

// Create per-method classes (that all serialize to the same MethodMatcher class + param)
// for each supported HTTP method, as a methodName -> methodClass lookup object.
export const MethodMatchers = _.reduce<MethodName, {
    [K in MethodName]: { new(): TypedMethodMatcher<K> }
}>(
    MethodNames,
    (result, method) => {
        result[method] = class SpecificMethodMatcher extends httpMatchers.MethodMatcher {

            readonly uiType = method;

            constructor() {
                super(Method[method]);
            }

            explain() {
                return `${Method[this.method]} requests`;
            }
        } as any; // Difficult to get TS to infer or accept TypedMethodMatcher<typeof method>
        return result;
    },
    {} as any
);

// Tiny interface to let us make the METHOD -> methodMatcher{ uiType: METHOD } mapping explicit
interface TypedMethodMatcher<R extends MethodName> extends httpMatchers.MethodMatcher {
    readonly uiType: R;
}

// Override various specific & actions, so we can inject our own specific
// explanations for certain cases

export class WildcardMatcher extends httpMatchers.WildcardMatcher {
    explain() {
        return 'Any requests';
    }
}

export class DefaultWildcardMatcher extends httpMatchers.WildcardMatcher {

    readonly uiType = 'default-wildcard';

    explain() {
        return 'Any other requests';
    }
}

export class AmIUsingMatcher extends httpMatchers.RegexPathMatcher {

    readonly uiType = 'am-i-using';

    constructor() {
        // Optional slash is for backward compat: for server 0.1.18+ it's always present
        super(/^https?:\/\/amiusing\.httptoolkit\.tech\/?$/);
    }

    explain() {
        return 'for amiusing.httptoolkit.tech';
    }
}

export class StaticResponseStep extends httpSteps.FixedResponseStep {
    explain() {
        return `respond with status ${this.status}${
            byteLength(this.data) ? ' and static content' : ''
        }`;
    }
}

// Ensure that JSON-ified buffers deserialize as real buffers
serializr.createModelSchema(StaticResponseStep, {
    data: serializr.custom(
        (data: StaticResponseStep['data']): string | MockttpSerializedBuffer | undefined => {
            if (!data || typeof data === 'string' || isSerializedBuffer(data)) {
                return data;
            } else {
                return { type: 'Buffer', data: [...data] };
            }
        },
        (serializedData: string | MockttpSerializedBuffer | undefined) => {
            if (!serializedData) {
                return undefined;
            } else if (typeof serializedData === 'string') {
                return serializedData;
            } else {
                return Buffer.from(serializedData.data);
            }
        },
    ),
    '*': Object.assign(
        serializr.custom(
            (x) => x,
            (x) => x
        ),
        { pattern: { test: (key: string) => key !== 'data' } }
    )
}, () => new StaticResponseStep(200));


export class FromFileResponseStep extends httpSteps.FileStep {
    explain() {
        return `respond with status ${this.status} and content from ${this.filePath || 'a file'}`;
    }
}

export class PassThroughStep extends httpSteps.PassThroughStep {

    constructor(rulesStore: RulesStore) {
        super(rulesStore.activePassthroughOptions);
    }

}

serializr.createModelSchema(PassThroughStep, {
    type: serializr.primitive()
}, (context) => new PassThroughStep(context.args.rulesStore));

export class ForwardToHostStep extends httpSteps.PassThroughStep {

    readonly uiType = 'forward-to-host';

    constructor(protocol: string | undefined, host: string, updateHostHeader: boolean, rulesStore: RulesStore) {
        super({
            ...rulesStore.activePassthroughOptions,
            transformRequest: {
                ...rulesStore.activePassthroughOptions.transformRequest,
                replaceHost: {
                    targetHost: host,
                    updateHostHeader: updateHostHeader
                },
                // If a protocol is specified, we separately redirect to that too:
                ...(protocol ? {
                    setProtocol: protocol as 'http' | 'https'
                } : {})
            }
        });
    }

}

serializr.createModelSchema(ForwardToHostStep, {
    uiType: serializeAsTag(() => 'forward-to-host'),
    type: serializr.primitive(),
    transformRequest: serializr.object(
        serializr.createSimpleSchema({
            replaceHost: serializr.raw(),
            setProtocol: serializr.primitive(),
        })
    )
}, (context) => {
    const data = context.json;
    return new ForwardToHostStep(
        data.transformRequest.setProtocol,
        data.transformRequest.replaceHost.targetHost,
        data.transformRequest.replaceHost.updateHostHeader,
        context.args.rulesStore
    );
});

export type RequestTransform = httpSteps.RequestTransform;
export type ResponseTransform = httpSteps.ResponseTransform;

export class TransformingStep extends httpSteps.PassThroughStep {

    readonly uiType = 'req-res-transformer';

    constructor(
        rulesStore: RulesStore,
        transformRequest: RequestTransform,
        transformResponse: ResponseTransform
    ) {
        super({
            ...rulesStore.activePassthroughOptions,
            transformRequest,
            transformResponse
        });
    }

    explain() {
        const activeRequestTransforms = _.pickBy(this.transformRequest || {}, (v) => v !== undefined);
        const activeResponseTransforms = _.pickBy(this.transformResponse || {}, (v) => v !== undefined);

        if (_.isEmpty(activeRequestTransforms) && _.isEmpty(activeResponseTransforms)) {
            return super.explain();
        } else if (!_.isEmpty(activeRequestTransforms) && !_.isEmpty(activeResponseTransforms)) {
            return "automatically transform the request and response";
        } else if (!_.isEmpty(activeRequestTransforms)) {
            return "automatically transform the request then pass it through to the target host";
        } else { // Must be response only
            return "automatically transform the response from the target host";
        }
    }

    // We override rule equality checks, to simplify them to treat undefined and missing
    // properties as different, because that matters for various transform properties.
    [CUSTOM_RULE_EQUALS](stepA: TransformingStep, stepB: TransformingStep): boolean {
        return _.isEqual(stepA.transformRequest, stepB.transformRequest) &&
            _.isEqual(stepA.transformResponse, stepB.transformResponse);
    }

}

const MatchReplaceSerializer = serializr.list(
    serializr.custom(
        ([key, value]: [RegExp, string]) =>
            [{ source: key.source, flags: key.flags }, value],
        ([key, value]: [{ source: string, flags: string }, string]) =>
            [new RegExp(key.source, key.flags), value]
    )
);

serializr.createModelSchema(TransformingStep, {
    uiType: serializeAsTag(() => 'req-res-transformer'),
    transformRequest: serializr.object(
        serializr.createSimpleSchema({
            matchReplaceHost: serializr.object(
                serializr.createSimpleSchema({
                    replacements: MatchReplaceSerializer,
                    '*': Object.assign(serializr.raw(), { pattern: { test: () => true } })
                })
            ),
            matchReplacePath: MatchReplaceSerializer,
            matchReplaceQuery: MatchReplaceSerializer,
            updateHeaders: serializeWithUndefineds,
            updateJsonBody: serializeWithUndefineds,
            replaceBody: serializeBuffer,
            matchReplaceBody: MatchReplaceSerializer,
            '*': Object.assign(serializr.raw(), { pattern: { test: () => true } })
        })
    ),
    transformResponse: serializr.object(
        serializr.createSimpleSchema({
            updateHeaders: serializeWithUndefineds,
            updateJsonBody: serializeWithUndefineds,
            replaceBody: serializeBuffer,
            matchReplaceBody: serializr.list(
                serializr.custom(
                    ([key, value]: [RegExp, string]) =>
                        [{ source: key.source, flags: key.flags }, value],
                    ([key, value]: [{ source: string, flags: string }, string]) =>
                        [new RegExp(key.source, key.flags), value]
                )
            ),
            '*': Object.assign(serializr.raw(), { pattern: { test: () => true } })
        })
    )
}, (context) => {
    const data = context.json;
    return new TransformingStep(
        context.args.rulesStore,
        data.transformRequest,
        data.transformResponse
    );
});

export class RequestBreakpointStep extends httpSteps.PassThroughStep {

    readonly uiType = 'request-breakpoint';

    constructor(rulesStore: RulesStore) {
        super({
            ...rulesStore.activePassthroughOptions,
            beforeRequest: rulesStore.triggerRequestBreakpoint
        });
    }

    explain() {
        return "manually rewrite the request before it's forwarded";
    }
}

serializr.createModelSchema(RequestBreakpointStep, {
    uiType: serializeAsTag(() => 'request-breakpoint'),
    type: serializr.primitive()
}, (context) => new RequestBreakpointStep(context.args.rulesStore));

export class ResponseBreakpointStep extends httpSteps.PassThroughStep {

    readonly uiType = 'response-breakpoint';

    constructor(rulesStore: RulesStore) {
        super({
            ...rulesStore.activePassthroughOptions,
            beforeResponse: rulesStore.triggerResponseBreakpoint
        });
    }

    explain() {
        return "manually rewrite the response before it's returned";
    }
}

serializr.createModelSchema(ResponseBreakpointStep, {
    uiType: serializeAsTag(() => 'response-breakpoint'),
    type: serializr.primitive()
}, (context) => new ResponseBreakpointStep(context.args.rulesStore));


export class RequestAndResponseBreakpointStep extends httpSteps.PassThroughStep {

    readonly uiType = 'request-and-response-breakpoint';

    constructor(rulesStore: RulesStore) {
        super({
            ...rulesStore.activePassthroughOptions,
            beforeRequest: rulesStore.triggerRequestBreakpoint,
            beforeResponse: rulesStore.triggerResponseBreakpoint
        });
    }

    explain() {
        return "manually rewrite the request and response";
    }
}

serializr.createModelSchema(RequestAndResponseBreakpointStep, {
    uiType: serializeAsTag(() => 'request-and-response-breakpoint'),
    type: serializr.primitive()
}, (context) => new RequestAndResponseBreakpointStep(context.args.rulesStore));

export type RequestWebhookEvents = httpSteps.RequestWebhookEvents;

export class WebhookStep extends httpSteps.WebhookStep {
    explain() {
        return `enable ${
            this.events.length === 1 ? this.events[0] : ''
        } webhooks`;
    }
}

export type DelayStep = httpSteps.DelayStep;
export const DelayStep = httpSteps.DelayStep;
export type TimeoutStep = httpSteps.TimeoutStep;
export const TimeoutStep = httpSteps.TimeoutStep;
export type CloseConnectionStep = httpSteps.CloseConnectionStep;
export const CloseConnectionStep = httpSteps.CloseConnectionStep;
export type ResetConnectionStep = httpSteps.ResetConnectionStep;
export const ResetConnectionStep = httpSteps.ResetConnectionStep;

export const HttpMatcherLookup = {
    ..._.omit(httpMatchers.MatcherLookup, ['method']), // We skip method to use per-method matchers instead
    ...MethodMatchers,

    // Replace the built-in wildcard matcher with our own:
    'wildcard': WildcardMatcher,
    // Add special types for our built-in matcher explanation overrides:
    'default-wildcard': DefaultWildcardMatcher,
    'am-i-using': AmIUsingMatcher
};

export const HttpInitialMatcherClasses = [
    WildcardMatcher,
    ...Object.values(MethodMatchers)
];

export const HttpStepLookup = {
    ...httpSteps.StepDefinitionLookup,
    'passthrough': PassThroughStep,
    'simple': StaticResponseStep,
    'file': FromFileResponseStep,
    'forward-to-host': ForwardToHostStep,
    'req-res-transformer': TransformingStep,
    'request-breakpoint': RequestBreakpointStep,
    'response-breakpoint': ResponseBreakpointStep,
    'request-and-response-breakpoint': RequestAndResponseBreakpointStep,
    'webhook': WebhookStep
};

type HttpMatcherClass = typeof HttpMatcherLookup[keyof typeof HttpMatcherLookup];
export type HttpMatcher = InstanceType<HttpMatcherClass>;
export type HttpInitialMatcher = InstanceType<typeof HttpInitialMatcherClasses[number]>;

type HttpStepClass = typeof HttpStepLookup[keyof typeof HttpStepLookup];
type HttpStep = InstanceType<HttpStepClass>;

export interface HttpRule extends Omit<RequestRuleData, 'matchers'> {
    id: string;
    type: 'http';
    activated: boolean;
    matchers: Array<HttpMatcher> & { 0?: HttpInitialMatcher };
    steps: Array<HttpStep>;
    completionChecker: completionCheckers.Always; // HTK rules all *always* match
};