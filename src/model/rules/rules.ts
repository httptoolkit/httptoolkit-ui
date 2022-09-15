import * as _ from 'lodash';
import {
    serverVersion as serverVersionObservable,
    versionSatisfies,
    BODY_MATCHING_RANGE,
    HOST_MATCHER_SERVER_RANGE,
    FROM_FILE_HANDLER_SERVER_RANGE,
    PASSTHROUGH_TRANSFORMS_RANGE,
    WEBSOCKET_MESSAGING_RULES_SUPPORTED,
    JSONRPC_RESPONSE_RULE_SUPPORTED
} from '../../services/service-versions';

import {
    StaticResponseHandler,
    ForwardToHostHandler,
    TimeoutHandler,
    CloseConnectionHandler,
    FromFileResponseHandler,
    TransformingHandler,
    HttpMatcherLookup,
    HttpHandlerLookup,
    HttpMockRule,
    HttpInitialMatcherClasses
} from './definitions/http-rule-definitions';

import {
    WebSocketMatcherLookup,
    WebSocketHandlerLookup,
    WebSocketMockRule,
    WebSocketInitialMatcherClasses,
    EchoWebSocketHandlerDefinition,
    RejectWebSocketHandlerDefinition,
    ListenWebSocketHandlerDefinition
} from './definitions/websocket-rule-definitions';

import {
    EthereumMatcherLookup,
    EthereumHandlerLookup,
    EthereumInitialMatcherClasses,
    EthereumMockRule
} from './definitions/ethereum-rule-definitions';

import {
    IpfsMockRule,
    IpfsMatcherLookup,
    IpfsInitialMatcherClasses,
    IpfsHandlerLookup
} from './definitions/ipfs-rule-definitions';

/// --- Part-generic logic ---

export const getRulePartKey = (part: {
    type: string,
    uiType?: string
})=>
    // Mockttp and friends define a 'type' field that's used for (de)serialization.
    // In addition, we define a uiType, for more specific representations of the
    // same rule part in some cases, which takes precedence.
    (part.uiType ?? part.type) as
        keyof typeof MatcherLookup | keyof typeof HandlerLookup;

const PartVersionRequirements: {
    [PartType in keyof typeof MatcherLookup | keyof typeof HandlerLookup]?: string
} = {
    // Matchers:
    'host': HOST_MATCHER_SERVER_RANGE,
    'raw-body': BODY_MATCHING_RANGE,
    'raw-body-regexp': BODY_MATCHING_RANGE,
    'raw-body-includes': BODY_MATCHING_RANGE,
    'json-body': BODY_MATCHING_RANGE,
    'json-body-matching': BODY_MATCHING_RANGE,
    'ethereum-method': JSONRPC_RESPONSE_RULE_SUPPORTED, // Usable without, but a bit pointless

    // Handlers:
    'file': FROM_FILE_HANDLER_SERVER_RANGE,
    'req-res-transformer': PASSTHROUGH_TRANSFORMS_RANGE,
    'ws-echo': WEBSOCKET_MESSAGING_RULES_SUPPORTED,
    'ws-listen': WEBSOCKET_MESSAGING_RULES_SUPPORTED,
    'ws-reject': WEBSOCKET_MESSAGING_RULES_SUPPORTED
};

const serverSupports = (versionRequirement: string | undefined) => {
    if (!versionRequirement || versionRequirement === '*') return true;

    // If we haven't got the server version yet, assume it doesn't support this
    if (serverVersionObservable.state !== 'fulfilled') return false;

    const version = serverVersionObservable.value as string; // Fulfilled -> string value
    return versionSatisfies(version, versionRequirement);
}

/// --- Matchers ---

const MatchersByType = {
    'http': HttpMatcherLookup,
    'websocket': WebSocketMatcherLookup,
    'ethereum': EthereumMatcherLookup,
    'ipfs': IpfsMatcherLookup
};

// Define maps to/from matcher keys to matcher classes, and
// types for the matchers & classes themselves; both the built-in
// ones and our own extra additions & overrides.
export const MatcherLookup = {
    // These are kept as references to MatchersByType, so the content is always the same:
    ...MatchersByType['http'],
    ...MatchersByType['websocket'],
    ...MatchersByType['ethereum'],
    ...MatchersByType['ipfs']
};

export type MatcherClassKey = keyof typeof MatcherLookup;
export type MatcherClass = typeof MatcherLookup[MatcherClassKey];
export type Matcher = typeof MatcherLookup extends {
    // Enforce that keys match .type or uiType for each matcher class:
    [K in keyof typeof MatcherLookup]: new (...args: any[]) => { type: K } | { uiType: K }
}
    ? InstanceType<MatcherClass>
    : never;

export const isCompatibleMatcher = (matcher: Matcher, type: RuleType) => {
    const matcherKey = getRulePartKey(matcher);
    return !!(MatchersByType[type] as _.Dictionary<MatcherClass>)[matcherKey];
};

// A runtime map from class to the 'uiType'/'type' key that will be
// present on constructed instances.
export const MatcherClassKeyLookup = new Map<MatcherClass, MatcherClassKey>(
    Object.entries(MatcherLookup)
    .map(
        ([key, matcher]) => [matcher, key]
    ) as Array<[MatcherClass, MatcherClassKey]>
);

/// --- Handlers ---

export const HandlersByType = {
    'http': HttpHandlerLookup,
    'websocket': WebSocketHandlerLookup,
    'ethereum': EthereumHandlerLookup,
    'ipfs': IpfsHandlerLookup
};

// Define maps to/from handler keys to handler classes, and
// types for the handlers & classes themselves; both the built-in
// ones and our own extra additions & overrides.
export const HandlerLookup = {
    // These are kept as references to HandlersByType, so the content is always the same:
    ...HandlersByType['http'],
    ...HandlersByType['websocket'],
    ...HandlersByType['ethereum']
};

export type HandlerClassKey = keyof typeof HandlerLookup;
export type HandlerClass = typeof HandlerLookup[HandlerClassKey];
export type Handler = typeof HandlerLookup extends {
    // Enforce that keys match .type or uiType for each handler class:
    [K in keyof typeof HandlerLookup]: new (...args: any[]) => { type: K } | { uiType: K }
}
    ? InstanceType<HandlerClass>
    : never;

export const HandlerClassKeyLookup = new Map<HandlerClass, HandlerClassKey>(
    Object.entries(HandlerLookup)
    .map(
        ([key, handler]) => [handler, key]
    ) as Array<[HandlerClass, HandlerClassKey]>
);

export const isCompatibleHandler = (handler: Handler, type: RuleType) => {
    const handlerKey = getRulePartKey(handler);
    return !!(HandlersByType[type] as _.Dictionary<HandlerClass>)[handlerKey];
};

/// --- Matcher/handler special categories ---

const InitialMatcherClasses = [
    ...HttpInitialMatcherClasses,
    ...WebSocketInitialMatcherClasses,
    ...EthereumInitialMatcherClasses,
    ...IpfsInitialMatcherClasses
];

export const getInitialMatchers = () => InitialMatcherClasses.filter((matcherCls) => {
    const matcherKey = MatcherClassKeyLookup.get(matcherCls)!;
    return serverSupports(PartVersionRequirements[matcherKey]);
});

export type InitialMatcherClass = typeof InitialMatcherClasses[number];
export type InitialMatcher = InstanceType<InitialMatcherClass>;
export type InitialMatcherKey = {
    [K in MatcherClassKey]: typeof MatcherLookup[K] extends InitialMatcherClass ? K : never
}[MatcherClassKey];

export const getRuleTypeFromInitialMatcher = (matcher: InitialMatcher): RuleType => {
    const matcherClass = matcher.constructor as any;

    if (HttpInitialMatcherClasses.includes(matcherClass)) {
        return 'http';
    } else if (WebSocketInitialMatcherClasses.includes(matcherClass)) {
        return 'websocket';
    } else if (EthereumInitialMatcherClasses.includes(matcherClass)) {
        return 'ethereum';
    } else if (IpfsInitialMatcherClasses.includes(matcherClass)) {
        return 'ipfs';
    } else {
        throw new Error(`Unknown type for initial matcher class: ${matcherClass.name}`);
    }
}

// Some real matchers aren't shown in the selection dropdowns, either because they're not suitable
// for use here, or because we just don't support them yet:
const HiddenMatchers = [
    'callback',
    'am-i-using',
    'default-wildcard',
    'default-ws-wildcard',
    'multipart-form-data',
    'raw-body-regexp',
    'hostname',
    'port',
    'protocol',
    'form-data',
    'cookie'
] as const;

type HiddenMatcherKey = typeof HiddenMatchers[number];

export type AdditionalMatcherKey = Exclude<MatcherClassKey, HiddenMatcherKey | InitialMatcherKey>;
type AdditionalMatcher = typeof MatcherLookup[AdditionalMatcherKey];

// The set of non-initial matchers a user can pick for a given rule.
export const getAvailableAdditionalMatchers = (ruleType: RuleType): AdditionalMatcher[] => {
    return Object.values(MatchersByType[ruleType])
        .filter((matcher: MatcherClass) => {
            const matcherKey = MatcherClassKeyLookup.get(matcher)!;

            if (HiddenMatchers.includes(matcherKey as HiddenMatcherKey)) return false;
            if (InitialMatcherClasses.includes(matcher as any)) return false;

            return serverSupports(PartVersionRequirements[matcherKey]);
        });
};

export const isHiddenMatcherKey = (key: MatcherClassKey) =>
    HiddenMatchers.includes(key as HiddenMatcherKey);

const HiddenHandlers = [
    'callback',
    'stream'
] as const;

type HiddenHandlerKey = typeof HiddenHandlers[number];
export type AvailableHandlerKey = Exclude<HandlerClassKey, HiddenHandlerKey>;
type AvailableHandler = typeof HandlerLookup[AvailableHandlerKey];

export const getAvailableHandlers = (ruleType: RuleType): AvailableHandler[] => {
    return Object.values(HandlersByType[ruleType])
        .filter((handler) => {
            const handlerKey = HandlerClassKeyLookup.get(handler)!;

            if (HiddenHandlers.includes(handlerKey as HiddenHandlerKey)) return false;

            return serverSupports(PartVersionRequirements[handlerKey]);
        });
};

const PaidHandlerClasses: HandlerClass[] = [
    StaticResponseHandler,
    FromFileResponseHandler,
    ForwardToHostHandler,
    TransformingHandler,
    TimeoutHandler,
    CloseConnectionHandler,
    EchoWebSocketHandlerDefinition,
    RejectWebSocketHandlerDefinition,
    ListenWebSocketHandlerDefinition
];

export const isPaidHandler = (handler: Handler) => {
    return _.some(PaidHandlerClasses, (cls) => handler instanceof cls);
}

export const isPaidHandlerClass = (handlerClass: HandlerClass) => {
    return PaidHandlerClasses.includes(handlerClass);
}

/// --- Rules ---

export type HtkMockRule =
    | HttpMockRule
    | WebSocketMockRule
    | EthereumMockRule
    | IpfsMockRule;

export type RuleType = HtkMockRule['type'];

const matchRuleType = <T extends RuleType>(
    ...types: T[]
) => (rule: HtkMockRule): rule is HtkMockRule & { type: T } =>
    types.includes(rule.type as T);

export const isHttpBasedRule = matchRuleType('http', 'ethereum', 'ipfs');
export const isWebSocketRule = matchRuleType('websocket');