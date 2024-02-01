import * as _ from 'lodash';
import {
    serverVersion as serverVersionObservable,
    versionSatisfies,
    BODY_MATCHING_RANGE,
    HOST_MATCHER_SERVER_RANGE,
    FROM_FILE_HANDLER_SERVER_RANGE,
    PASSTHROUGH_TRANSFORMS_RANGE,
    WEBSOCKET_MESSAGING_RULES_SUPPORTED,
    JSONRPC_RESPONSE_RULE_SUPPORTED,
    RTC_RULES_SUPPORTED,
    CONNECTION_RESET_SUPPORTED
} from '../../services/service-versions';

import {
    StaticResponseHandler,
    ForwardToHostHandler,
    TimeoutHandler,
    CloseConnectionHandler,
    ResetConnectionHandler,
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
    EthereumMockRule,
    EthereumMethodMatcher
} from './definitions/ethereum-rule-definitions';

import {
    IpfsMockRule,
    IpfsMatcherLookup,
    IpfsInitialMatcherClasses,
    IpfsHandlerLookup,
    IpfsInteractionMatcher
} from './definitions/ipfs-rule-definitions';

import {
    RTCMatcherLookup,
    RTCStepLookup,
    RTCMockRule,
    RTCInitialMatcherClasses
} from './definitions/rtc-rule-definitions';

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

    'eth-method': JSONRPC_RESPONSE_RULE_SUPPORTED, // Usable without, but a bit pointless
    'rtc-wildcard': RTC_RULES_SUPPORTED,

    // Handlers:
    'file': FROM_FILE_HANDLER_SERVER_RANGE,
    'req-res-transformer': PASSTHROUGH_TRANSFORMS_RANGE,
    'ws-echo': WEBSOCKET_MESSAGING_RULES_SUPPORTED,
    'ws-listen': WEBSOCKET_MESSAGING_RULES_SUPPORTED,
    'ws-reject': WEBSOCKET_MESSAGING_RULES_SUPPORTED,
    'reset-connection': CONNECTION_RESET_SUPPORTED
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
    'ipfs': IpfsMatcherLookup,
    'webrtc': RTCMatcherLookup
};

// Define maps to/from matcher keys to matcher classes, and
// types for the matchers & classes themselves; both the built-in
// ones and our own extra additions & overrides.
export const MatcherLookup = {
    // These are kept as references to MatchersByType, so the content is always the same:
    ...MatchersByType['http'],
    ...MatchersByType['websocket'],
    ...MatchersByType['ethereum'],
    ...MatchersByType['ipfs'],
    ...MatchersByType['webrtc']
};

// This const isn't used, but the assignment conveniently and clearly checks if
// any handlers are created without the correct + readonly type/uiType values.
const __MATCHER_KEY_CHECK__: {
    // Enforce that keys match .type or uiType for each matcher class:
    [K in keyof typeof MatcherLookup]: new (...args: any[]) => { type: K } | { uiType: K }
} = MatcherLookup;

export type MatcherClassKey = keyof typeof MatcherLookup;
export type MatcherClass = typeof MatcherLookup[MatcherClassKey];
export type Matcher = InstanceType<MatcherClass>;

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
    'ipfs': IpfsHandlerLookup,
    'webrtc': RTCStepLookup
};

// Define maps to/from handler keys to handler classes, and
// types for the handlers & classes themselves; both the built-in
// ones and our own extra additions & overrides.
export const HandlerLookup = {
    // These are kept as references to HandlersByType, so the content is always the same:
    ...HandlersByType['http'],
    ...HandlersByType['websocket'],
    ...HandlersByType['ethereum'],
    ...HandlersByType['ipfs'],
    ...HandlersByType['webrtc']
};

// This const isn't used, but the assignment conveniently and clearly checks if
// any handlers are created without the correct + readonly type/uiType values.
const __HANDLER_KEY_CHECK__: {
    // Enforce that keys match .type or uiType for each handler class:
    [K in keyof typeof HandlerLookup]: new (...args: any[]) => { type: K } | { uiType: K }
} = HandlerLookup;

export type HandlerClassKey = keyof typeof HandlerLookup;
export type HandlerClass = typeof HandlerLookup[HandlerClassKey];
export type Handler = InstanceType<HandlerClass>;

// Steps are a subset of handlers which are allowed to appear in 'steps' arrays on rules, for rule types
// that support defining a series of steps to execute.
const HandlerSteps = {
    ...RTCStepLookup
};
export type HandlerStepClass = typeof HandlerSteps[keyof typeof HandlerSteps];
export type HandlerStep = InstanceType<HandlerStepClass>;

export const HandlerClassKeyLookup = new Map<HandlerClass, HandlerClassKey>(
    Object.entries(HandlerLookup)
    .map(
        ([key, handler]) => [handler, key]
    ) as Array<[HandlerClass, HandlerClassKey]>
);

export const isCompatibleHandler = (handler: Handler, initialMatcher: InitialMatcher) => {
    const handlerKey = getRulePartKey(handler) as HandlerClassKey;

    const ruleType = getRuleTypeFromInitialMatcher(initialMatcher);
    const handlersForType = HandlersByType[ruleType] as _.Dictionary<HandlerClass>
    const equivalentHandler = handlersForType[handlerKey];

    // Some handlers require a specific initial matcher, or they're not available.
    // In those cases, we check the initial matcher is valid:
    const matcherCheck = MatcherLimitedHandlers[handlerKey];
    if (matcherCheck !== undefined && !matcherCheck(initialMatcher)) return false;

    return equivalentHandler !== undefined;
};

/// --- Matcher/handler special categories ---

const InitialMatcherClasses = [
    ...HttpInitialMatcherClasses,
    ...WebSocketInitialMatcherClasses,
    ...EthereumInitialMatcherClasses,
    ...IpfsInitialMatcherClasses,
    ...RTCInitialMatcherClasses
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

export const getRuleTypeFromInitialMatcher = (matcher: InitialMatcher | MatcherClassKey): RuleType => {
    const matcherClass = _.isString(matcher)
        ? MatcherLookup[matcher]
        : matcher.constructor as any;

    if (HttpInitialMatcherClasses.includes(matcherClass)) {
        return 'http';
    } else if (WebSocketInitialMatcherClasses.includes(matcherClass)) {
        return 'websocket';
    } else if (EthereumInitialMatcherClasses.includes(matcherClass)) {
        return 'ethereum';
    } else if (IpfsInitialMatcherClasses.includes(matcherClass)) {
        return 'ipfs';
    } else if (RTCInitialMatcherClasses.includes(matcherClass)) {
        return 'webrtc';
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
    'regex-url',
    'hostname',
    'port',
    'protocol',
    'form-data',
    'cookie',

    'rtc-page-hostname',
    'rtc-page-regex',
    'rtc-user-agent-regex'
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
    'json-rpc-response', // Only used internally, by Ethereum rules
    'rtc-peer-proxy', // Not usable interactively
    'callback',
    'stream',
    'wait-for-rtc-track' // Not super useful here I think
] as const;

const MatcherLimitedHandlers: {
    [K in HandlerClassKey]?: ((matcher: InitialMatcher) => boolean)
} = {
    // Ethereum interaction-specific handlers:
    'eth-call-result': (matcher: InitialMatcher) =>
        matcher instanceof EthereumMethodMatcher &&
        matcher.methodName === 'eth_call',
    'eth-number-result': (matcher: InitialMatcher) =>
        matcher instanceof EthereumMethodMatcher &&
        [
            'eth_getBalance',
            'eth_blockNumber',
            'eth_gasPrice'
        ].includes(matcher.methodName),
    'eth-hash-result': (matcher: InitialMatcher) =>
        matcher instanceof EthereumMethodMatcher &&
        [
            'eth_sendRawTransaction',
            'eth_sendTransaction'
        ].includes(matcher.methodName),
    'eth-receipt-result': (matcher: InitialMatcher) =>
        matcher instanceof EthereumMethodMatcher &&
        matcher.methodName === 'eth_getTransactionReceipt',
    'eth-block-result': (matcher: InitialMatcher) =>
        matcher instanceof EthereumMethodMatcher &&
        [
            'eth_getBlockByHash',
            'eth_getBlockByNumber'
        ].includes(matcher.methodName),

    // IPFS interaction-specific handlers:
    'ipfs-cat-text': (matcher: InitialMatcher) =>
        matcher instanceof IpfsInteractionMatcher &&
        matcher.interactionName === 'cat',
    'ipfs-cat-file': (matcher: InitialMatcher) =>
        matcher instanceof IpfsInteractionMatcher &&
        matcher.interactionName === 'cat',
    'ipfs-add-result': (matcher: InitialMatcher) =>
        matcher instanceof IpfsInteractionMatcher &&
        matcher.interactionName === 'add',
    'ipns-resolve-result': (matcher: InitialMatcher) =>
        matcher instanceof IpfsInteractionMatcher &&
        matcher.interactionName === 'name/resolve',
    'ipns-publish-result': (matcher: InitialMatcher) =>
        matcher instanceof IpfsInteractionMatcher &&
        matcher.interactionName === 'name/publish',
    'ipfs-pins-result': (matcher: InitialMatcher) =>
        matcher instanceof IpfsInteractionMatcher &&
        [
            'pin/add',
            'pin/rm'
        ].includes(matcher.interactionName),
    'ipfs-pin-ls-result': (matcher: InitialMatcher) =>
        matcher instanceof IpfsInteractionMatcher &&
        matcher.interactionName === 'pin/ls',
};

type HiddenHandlerKey = typeof HiddenHandlers[number];
export type AvailableHandlerKey = Exclude<HandlerClassKey, HiddenHandlerKey>;
export type AvailableHandler = typeof HandlerLookup[AvailableHandlerKey];

export const getAvailableHandlers = (
    ruleType: RuleType,
    initialMatcher: InitialMatcher | undefined
): AvailableHandler[] => {
    return Object.values(HandlersByType[ruleType])
        .filter((handler) => {
            const handlerKey = HandlerClassKeyLookup.get(handler)!;

            if (HiddenHandlers.includes(handlerKey as HiddenHandlerKey)) return false;

            // Some handlers require a specific initial matcher, or they're not available.
            // In those cases, we check the initial matcher is valid:
            const matcherCheck = MatcherLimitedHandlers[handlerKey];
            if (
                matcherCheck !== undefined &&
                (!initialMatcher || !matcherCheck(initialMatcher))
            ) return false;

            return serverSupports(PartVersionRequirements[handlerKey]);
        });
};

const FinalHandlerSteps = [
    'echo-rtc',
    'rtc-peer-proxy',
    'rtc-dynamic-proxy',
    'close-rtc-connection'
] as const;

// Handlers are final if a) they're not steps, just normal handlers, or b) if they are steps, but
// they're final steps that preclude any further interactions (e.g. closing a connection).
export const isFinalHandler = (handler: Handler) => {
    const handlerKey = getRulePartKey(handler) as any; // Any -> can't includes() const arrays otherwise

    return !Object.keys(HandlerSteps).includes(handlerKey) ||
        FinalHandlerSteps.includes(handlerKey);
}

const PaidHandlerClasses: HandlerClass[] = [
    StaticResponseHandler,
    FromFileResponseHandler,
    ForwardToHostHandler,
    TransformingHandler,
    TimeoutHandler,
    CloseConnectionHandler,
    ResetConnectionHandler,
    EchoWebSocketHandlerDefinition,
    RejectWebSocketHandlerDefinition,
    ListenWebSocketHandlerDefinition
];

export const isPaidHandler = (
    ruleType: RuleType,
    handler: Handler
) => {
    if (ruleType !== 'http' && ruleType !== 'websocket') return false;
    return _.some(PaidHandlerClasses, (cls) => handler instanceof cls);
}

export const isPaidHandlerClass = (
    ruleType: RuleType,
    handlerClass: HandlerClass
) => {
    if (ruleType !== 'http' && ruleType !== 'websocket') return false;
    return PaidHandlerClasses.includes(handlerClass);
}

/// --- Rules ---

export type HtkMockRule = (
    | HttpMockRule
    | WebSocketMockRule
    | EthereumMockRule
    | IpfsMockRule
    | RTCMockRule
) & {
    title?: string;
};

export type RuleType = HtkMockRule['type'];

const matchRuleType = <T extends RuleType>(
    ...types: T[]
) => (type: string): type is T =>
    types.includes(type as T);

const matchRule = <T extends RuleType>(
    matcher: (type: string) => type is T
) => (rule: HtkMockRule): rule is HtkMockRule & { type: T } =>
    matcher(rule.type);

export const isHttpCompatibleType = matchRuleType('http', 'ethereum', 'ipfs');
export const isHttpBasedRule = matchRule(isHttpCompatibleType);
export const isWebSocketRule = matchRule(matchRuleType('websocket'));
export const isRTCRule = matchRule(matchRuleType('webrtc'));

export const isStepPoweredRule = isRTCRule;

export enum RulePriority {
    FALLBACK = 0,
    DEFAULT = 1,
    OVERRIDE = 2
}