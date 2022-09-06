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

/// --- Matchers ---

// Define maps to/from matcher keys to matcher classes, and
// types for the matchers & classes themselves; both the built-in
// ones and our own extra additions & overrides.
export const MatcherLookup = {
    ...HttpMatcherLookup,
    ...WebSocketMatcherLookup
};

export type MatcherClassKey = keyof typeof MatcherLookup;
export type MatcherClass = typeof MatcherLookup[MatcherClassKey];
export type Matcher = typeof MatcherLookup extends {
    // Enforce that keys match .type or uiType for each matcher class:
    [K in keyof typeof MatcherLookup]: new (...args: any[]) => { type: K } | { uiType: K }
}
    ? InstanceType<MatcherClass>
    : never;

/// --- Handlers ---

// Define maps to/from handler keys to handler classes, and
// types for the handlers & classes themselves; both the built-in
// ones and our own extra additions & overrides.
export const HandlerLookup = {
    ...HttpHandlerLookup,
    ...WebSocketHandlerLookup
};

export const MatcherKeys = new Map<MatcherClass, MatcherClassKey>(
    Object.entries(MatcherLookup)
    .map(
        ([key, matcher]) => [matcher, key]
    ) as Array<[MatcherClass, MatcherClassKey]>
);

export type HandlerClassKey = keyof typeof HandlerLookup;
export type HandlerClass = typeof HandlerLookup[HandlerClassKey];
export type Handler = typeof HandlerLookup extends {
    // Enforce that keys match .type or uiType for each handler class:
    [K in keyof typeof HandlerLookup]: new (...args: any[]) => { type: K } | { uiType: K }
}
    ? InstanceType<HandlerClass>
    : never;

export const HandlerKeys = new Map<HandlerClass, HandlerClassKey>(
    Object.entries(HandlerLookup)
    .map(
        ([key, handler]) => [handler, key]
    ) as Array<[HandlerClass, HandlerClassKey]>
);

/// --- Matcher/handler special categories ---

export const InitialMatcherClasses = [
    WildcardMatcher,
    ...Object.values(MethodMatchers)
];
export type InitialMatcherClass = typeof InitialMatcherClasses[0];
export type InitialMatcher = InstanceType<InitialMatcherClass>;

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

/// --- Rules ---

export type HtkMockRule =
    | WebSocketMockRule
    | HttpMockRule;

export type RuleType = HtkMockRule['type'];

const matchRuleType = <T extends RuleType>(
    type: T
) => (rule: HtkMockRule): rule is HtkMockRule & { type: T } =>
    rule.type === type;

export const isHttpRule = matchRuleType('http');
export const isWebSocketRule = matchRuleType('websocket');
