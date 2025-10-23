import * as _ from 'lodash';
import {
    serverSupports,
    BODY_MATCHING_RANGE,
    HOST_MATCHER_SERVER_RANGE,
    FROM_FILE_HANDLER_SERVER_RANGE,
    PASSTHROUGH_TRANSFORMS_RANGE,
    WEBSOCKET_MESSAGING_RULES_SUPPORTED,
    JSONRPC_RESPONSE_RULE_SUPPORTED,
    RTC_RULES_SUPPORTED,
    CONNECTION_RESET_SUPPORTED,
    WEBHOOK_AND_DELAY_RULES
} from '../../services/service-versions';

import {
    HttpMatcherLookup,
    HttpStepLookup,
    HttpRule,
    HttpInitialMatcherClasses,
    RequestBreakpointStep,
    ResponseBreakpointStep,
    RequestAndResponseBreakpointStep,
    PassThroughStep
} from './definitions/http-rule-definitions';

import {
    WebSocketMatcherLookup,
    WebSocketStepLookup,
    WebSocketRule,
    WebSocketInitialMatcherClasses,
    WebSocketForwardToHostStep,
    WebSocketPassThroughStep
} from './definitions/websocket-rule-definitions';

import {
    EthereumMatcherLookup,
    EthereumStepLookup,
    EthereumInitialMatcherClasses,
    EthereumRule,
    EthereumMethodMatcher
} from './definitions/ethereum-rule-definitions';

import {
    IpfsRule,
    IpfsMatcherLookup,
    IpfsInitialMatcherClasses,
    IpfsStepLookup,
    IpfsInteractionMatcher
} from './definitions/ipfs-rule-definitions';

import {
    RTCMatcherLookup,
    RTCStepLookup,
    RTCRule,
    RTCInitialMatcherClasses
} from './definitions/rtc-rule-definitions';

export type {
    MatchReplacePairs
} from 'mockttp';

/// --- Part-generic logic ---

export const getRulePartKey = (part: {
    type: string,
    uiType?: string
})=>
    // Mockttp and friends define a 'type' field that's used for (de)serialization.
    // In addition, we define a uiType, for more specific representations of the
    // same rule part in some cases, which takes precedence.
    (part.uiType ?? part.type) as
        keyof typeof MatcherLookup | keyof typeof StepLookup;

const PartVersionRequirements: {
    [PartType in keyof typeof MatcherLookup | keyof typeof StepLookup]?: string
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

    // Steps:
    'file': FROM_FILE_HANDLER_SERVER_RANGE,
    'req-res-transformer': PASSTHROUGH_TRANSFORMS_RANGE,
    'ws-echo': WEBSOCKET_MESSAGING_RULES_SUPPORTED,
    'ws-listen': WEBSOCKET_MESSAGING_RULES_SUPPORTED,
    'ws-reject': WEBSOCKET_MESSAGING_RULES_SUPPORTED,
    'reset-connection': CONNECTION_RESET_SUPPORTED,
    'delay': WEBHOOK_AND_DELAY_RULES,
    'webhook': WEBHOOK_AND_DELAY_RULES
};

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
// any steps are created without the correct + readonly type/uiType values.
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

/// --- Steps ---

export const StepsByType = {
    'http': HttpStepLookup,
    'websocket': WebSocketStepLookup,
    'ethereum': EthereumStepLookup,
    'ipfs': IpfsStepLookup,
    'webrtc': RTCStepLookup
};

// Define maps to/from step keys to step classes, and
// types for the steps & classes themselves; both the built-in
// ones and our own extra additions & overrides.
export const StepLookup = {
    // These are kept as references to StepsByType, so the content is always the same:
    ...StepsByType['http'],
    ...StepsByType['websocket'],
    ...StepsByType['ethereum'],
    ...StepsByType['ipfs'],
    ...StepsByType['webrtc']
};

// This const isn't used, but the assignment conveniently and clearly checks if
// any steps are created without the correct + readonly type/uiType values.
const __STEP_KEY_CHECK__: {
    // Enforce that keys match .type or uiType for each step class:
    [K in keyof typeof StepLookup]: new (...args: any[]) => { type: K } | { uiType: K }
} = StepLookup;

export type StepClassKey = keyof typeof StepLookup;
export type StepClass = typeof StepLookup[StepClassKey];
export type Step = InstanceType<StepClass>;

export const StepClassKeyLookup = new Map<StepClass, StepClassKey>(
    Object.entries(StepLookup)
    .map(
        ([key, step]) => [step, key]
    ) as Array<[StepClass, StepClassKey]>
);

export const isCompatibleStep = (step: Step, initialMatcher: InitialMatcher) => {
    const stepKey = getRulePartKey(step) as StepClassKey;

    const ruleType = getRuleTypeFromInitialMatcher(initialMatcher);
    const stepsForType = StepsByType[ruleType] as _.Dictionary<StepClass>
    const equivalentStep = stepsForType[stepKey];

    // Some steps require a specific initial matcher, or they're not available.
    // In those cases, we check the initial matcher is valid:
    const matcherCheck = MatcherLimitedSteps[stepKey];
    if (matcherCheck !== undefined && !matcherCheck(initialMatcher)) return false;

    return equivalentStep !== undefined;
};

/// --- Matcher/step special categories ---

const InitialMatcherClasses = [
    ...HttpInitialMatcherClasses,
    ...WebSocketInitialMatcherClasses,
    ...EthereumInitialMatcherClasses,
    ...IpfsInitialMatcherClasses,
    ...RTCInitialMatcherClasses
];

export const StableRuleTypes = [
    'http',
    'websocket'
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

const HiddenSteps = [
    'json-rpc-response', // Only used internally, by Ethereum rules
    'rtc-peer-proxy', // Not usable interactively
    'callback',
    'stream',
    'wait-for-rtc-track', // Not super useful here I think
    'wait-for-request-body', // Not super useful here I think
] as const;

const MatcherLimitedSteps: {
    [K in StepClassKey]?: ((matcher: InitialMatcher) => boolean)
} = {
    // Ethereum interaction-specific steps:
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

    // IPFS interaction-specific steps:
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

type HiddenStepKey = typeof HiddenSteps[number];
export type AvailableStepKey = Exclude<StepClassKey, HiddenStepKey>;
export type AvailableStep = typeof StepLookup[AvailableStepKey];

export const getAvailableSteps = (
    ruleType: RuleType,
    initialMatcher: InitialMatcher | undefined
): AvailableStep[] => {
    return Object.values(StepsByType[ruleType])
        .filter((step) => {
            const stepKey = StepClassKeyLookup.get(step)!;

            if (HiddenSteps.includes(stepKey as HiddenStepKey)) return false;

            // Some steps require a specific initial matcher, or they're not available.
            // In those cases, we check the initial matcher is valid:
            const matcherCheck = MatcherLimitedSteps[stepKey];
            if (
                matcherCheck !== undefined &&
                (!initialMatcher || !matcherCheck(initialMatcher))
            ) return false;

            return serverSupports(PartVersionRequirements[stepKey]);
        });
};

export const isFinalStep = (step: Step) => {
    return StepLookup[step.type].isFinal === true;
}

const NonPaidStepClasses: StepClass[] = [
    // HTTP:
    RequestBreakpointStep,
    ResponseBreakpointStep,
    RequestAndResponseBreakpointStep,
    PassThroughStep,
    // WS:
    WebSocketPassThroughStep,
    WebSocketForwardToHostStep,
    // All non-HTTP/WS are free
];

export const isPaidStep = (
    ruleType: RuleType,
    step: Step
) => {
    if (ruleType !== 'http' && ruleType !== 'websocket') return false;
    return !_.some(NonPaidStepClasses, (cls) => step instanceof cls);
}

export const isPaidStepClass = (
    ruleType: RuleType,
    stepClass: StepClass
) => {
    if (ruleType !== 'http' && ruleType !== 'websocket') return false;
    return !NonPaidStepClasses.includes(stepClass);
}

export function areStepsModifying(stepTypes: StepClassKey[] | undefined): stepTypes is StepClassKey[] {
    // We don't show rule details or edit markers for no-modification rules
    return !!stepTypes?.length &&
        !stepTypes?.every(
            type => type === 'passthrough' ||
                    type === 'ws-passthrough' ||
                    type === 'webhook'
        );
}

/// --- Rules ---

export type HtkRule = (
    | HttpRule
    | WebSocketRule
    | EthereumRule
    | IpfsRule
    | RTCRule
) & {
    title?: string;
};

export type RuleType = HtkRule['type'];

const matchRuleType = <T extends RuleType>(
    ...types: T[]
) => (type: string): type is T =>
    types.includes(type as T);

const matchRule = <T extends RuleType>(
    matcher: (type: string) => type is T
) => (rule: HtkRule): rule is HtkRule & { type: T } =>
    matcher(rule.type);

export const isHttpCompatibleType = matchRuleType('http', 'ethereum', 'ipfs');
export const isHttpBasedRule = matchRule(isHttpCompatibleType);
export const isWebSocketRule = matchRule(matchRuleType('websocket'));
export const isRTCRule = matchRule(matchRuleType('webrtc'));

export enum RulePriority {
    FALLBACK = 0,
    DEFAULT = 1,
    OVERRIDE = 2
}