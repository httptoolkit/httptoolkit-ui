import * as _ from 'lodash';
import {
    RequestRuleData,
    Method,
    matchers as httpMatchers,
    requestHandlerDefinitions as httpHandlers,
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

export class StaticResponseHandler extends httpHandlers.SimpleHandlerDefinition {
    explain() {
        return `respond with status ${this.status}${
            byteLength(this.data) ? ' and static content' : ''
        }`;
    }
}

// Ensure that JSON-ified buffers deserialize as real buffers
serializr.createModelSchema(StaticResponseHandler, {
    data: serializr.custom(
        (data: StaticResponseHandler['data']): string | MockttpSerializedBuffer | undefined => {
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
}, () => new StaticResponseHandler(200));


export class FromFileResponseHandler extends httpHandlers.FileHandlerDefinition {
    explain() {
        return `respond with status ${this.status} and content from ${this.filePath || 'a file'}`;
    }
}

export class PassThroughHandler extends httpHandlers.PassThroughHandlerDefinition {

    constructor(rulesStore: RulesStore) {
        super(rulesStore.activePassthroughOptions);
    }

}

serializr.createModelSchema(PassThroughHandler, {
    type: serializr.primitive()
}, (context) => new PassThroughHandler(context.args.rulesStore));

export class ForwardToHostHandler extends httpHandlers.PassThroughHandlerDefinition {

    readonly uiType = 'forward-to-host';

    constructor(forwardToLocation: string, updateHostHeader: boolean, rulesStore: RulesStore) {
        super({
            ...rulesStore.activePassthroughOptions,
            forwarding: {
                targetHost: forwardToLocation,
                updateHostHeader: updateHostHeader
            }
        });
    }

}

serializr.createModelSchema(ForwardToHostHandler, {
    uiType: serializeAsTag(() => 'forward-to-host'),
    type: serializr.primitive(),
    forwarding: serializr.map(serializr.primitive())
}, (context) => {
    const data = context.json;
    return new ForwardToHostHandler(
        data.forwarding.targetHost,
        data.forwarding.updateHostHeader,
        context.args.rulesStore
    );
});

export type RequestTransform = httpHandlers.RequestTransform;
export type ResponseTransform = httpHandlers.ResponseTransform;

export class TransformingHandler extends httpHandlers.PassThroughHandlerDefinition {

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
    [CUSTOM_RULE_EQUALS](handlerA: TransformingHandler, handlerB: TransformingHandler): boolean {
        return _.isEqual(handlerA.transformRequest, handlerB.transformRequest) &&
            _.isEqual(handlerA.transformResponse, handlerB.transformResponse);
    }

}

serializr.createModelSchema(TransformingHandler, {
    uiType: serializeAsTag(() => 'req-res-transformer'),
    transformRequest: serializr.object(
        serializr.createSimpleSchema({
            updateHeaders: serializeWithUndefineds,
            updateJsonBody: serializeWithUndefineds,
            replaceBody: serializeBuffer,
            '*': Object.assign(serializr.raw(), { pattern: { test: () => true } })
        })
    ),
    transformResponse: serializr.object(
        serializr.createSimpleSchema({
            updateHeaders: serializeWithUndefineds,
            updateJsonBody: serializeWithUndefineds,
            replaceBody: serializeBuffer,
            '*': Object.assign(serializr.raw(), { pattern: { test: () => true } })
        })
    )
}, (context) => {
    const data = context.json;
    return new TransformingHandler(
        context.args.rulesStore,
        data.transformRequest,
        data.transformResponse
    );
});

export class RequestBreakpointHandler extends httpHandlers.PassThroughHandlerDefinition {

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

serializr.createModelSchema(RequestBreakpointHandler, {
    uiType: serializeAsTag(() => 'request-breakpoint'),
    type: serializr.primitive()
}, (context) => new RequestBreakpointHandler(context.args.rulesStore));

export class ResponseBreakpointHandler extends httpHandlers.PassThroughHandlerDefinition {

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

serializr.createModelSchema(ResponseBreakpointHandler, {
    uiType: serializeAsTag(() => 'response-breakpoint'),
    type: serializr.primitive()
}, (context) => new ResponseBreakpointHandler(context.args.rulesStore));


export class RequestAndResponseBreakpointHandler extends httpHandlers.PassThroughHandlerDefinition {

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

serializr.createModelSchema(RequestAndResponseBreakpointHandler, {
    uiType: serializeAsTag(() => 'request-and-response-breakpoint'),
    type: serializr.primitive()
}, (context) => new RequestAndResponseBreakpointHandler(context.args.rulesStore));

export type TimeoutHandler = httpHandlers.TimeoutHandlerDefinition;
export const TimeoutHandler = httpHandlers.TimeoutHandlerDefinition;
export type CloseConnectionHandler = httpHandlers.CloseConnectionHandlerDefinition;
export const CloseConnectionHandler = httpHandlers.CloseConnectionHandlerDefinition;
export type ResetConnectionHandler = httpHandlers.ResetConnectionHandlerDefinition;
export const ResetConnectionHandler = httpHandlers.ResetConnectionHandlerDefinition;

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

export const HttpHandlerLookup = {
    ...httpHandlers.HandlerDefinitionLookup,
    'passthrough': PassThroughHandler,
    'simple': StaticResponseHandler,
    'file': FromFileResponseHandler,
    'forward-to-host': ForwardToHostHandler,
    'req-res-transformer': TransformingHandler,
    'request-breakpoint': RequestBreakpointHandler,
    'response-breakpoint': ResponseBreakpointHandler,
    'request-and-response-breakpoint': RequestAndResponseBreakpointHandler
};

type HttpMatcherClass = typeof HttpMatcherLookup[keyof typeof HttpMatcherLookup];
export type HttpMatcher = InstanceType<HttpMatcherClass>;
export type HttpInitialMatcher = InstanceType<typeof HttpInitialMatcherClasses[number]>;

type HttpHandlerClass = typeof HttpHandlerLookup[keyof typeof HttpHandlerLookup];
type HttpHandler = InstanceType<HttpHandlerClass>;

export interface HttpMockRule extends Omit<RequestRuleData, 'matchers'> {
    id: string;
    type: 'http';
    activated: boolean;
    matchers: Array<HttpMatcher> & { 0?: HttpInitialMatcher };
    handler: HttpHandler;
    completionChecker: completionCheckers.Always; // HTK rules all *always* match
};