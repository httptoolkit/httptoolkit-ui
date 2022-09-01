import * as _ from 'lodash';

import {
    MethodMatchers,
    WildcardMatcher,
    StaticResponseHandler,
    ForwardToHostHandler,
    TimeoutHandler,
    CloseConnectionHandler,
    FromFileResponseHandler,
    TransformingHandler,
    HttpMatcherLookup,
    HttpHandlerLookup,
    HttpMockRule
} from './definitions/http-rule-definitions';

import {
    WebSocketMatcherLookup,
    WebSocketHandlerLookup,
    WebSocketMockRule
} from './definitions/websocket-rule-definitions';

// Define maps to/from matcher keys to matcher classes, and
// types for the matchers & classes themselves; both the built-in
// ones and our own extra additions & overrides.
export const MatcherLookup = {
    ...HttpMatcherLookup,
    ...WebSocketMatcherLookup
};

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
export const HandlerLookup = {
    ...HttpHandlerLookup,
    ...WebSocketHandlerLookup
};

const PaidHandlerClasses: HandlerClass[] = [
    StaticResponseHandler,
    FromFileResponseHandler,
    ForwardToHostHandler,
    TransformingHandler,
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

export const InitialMatcherClasses = [
    WildcardMatcher,
    ...Object.values(MethodMatchers)
];
export type InitialMatcherClass = typeof InitialMatcherClasses[0];
export type InitialMatcher = InstanceType<InitialMatcherClass>;

export type HtkMockRule =
    | WebSocketMockRule
    | HttpMockRule;

const matchRuleType = <T extends HtkMockRule['type']>(
    type: T
) => (rule: HtkMockRule): rule is HtkMockRule & { type: T } =>
    rule.type === type;

export const isHttpRule = matchRuleType('http');
export const isWebSocketRule = matchRuleType('websocket');
