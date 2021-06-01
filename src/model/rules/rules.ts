import * as _ from 'lodash';
import {
    handlers,
    matchers
} from 'mockttp';

import { Omit } from '../../types';

import {
    MethodMatchers,
    WildcardMatcher,
    StaticResponseHandler,
    AmIUsingMatcher,
    DefaultWildcardMatcher,
    ForwardToHostHandler,
    PassThroughHandler,
    RequestBreakpointHandler,
    ResponseBreakpointHandler,
    RequestAndResponseBreakpointHandler,
    TimeoutHandler,
    CloseConnectionHandler,
    FromFileResponseHandler,
    TransformingHandler
} from './rule-definitions';

// Define maps to/from matcher keys to matcher classes, and
// types for the matchers & classes themselves; both the built-in
// ones and our own extra additions & overrides.
export const MatcherLookup = Object.assign(
    {},
    matchers.MatcherLookup,
    MethodMatchers,
    {
        // Replace the built-in wildcard matcher with our own:
        wildcard: WildcardMatcher,
        // Add special types for our built-in matcher explanation overrides:
        'default-wildcard': DefaultWildcardMatcher,
        'am-i-using': AmIUsingMatcher
    }

);

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
export const HandlerLookup = Object.assign(
    {},
    handlers.HandlerLookup as Omit<typeof handlers.HandlerLookup, 'passthrough'>,
    {
        'passthrough': PassThroughHandler,
        'simple': StaticResponseHandler,
        'file': FromFileResponseHandler,
        'forward-to-host': ForwardToHostHandler,
        'req-res-transformer': TransformingHandler,
        'request-breakpoint': RequestBreakpointHandler,
        'response-breakpoint': ResponseBreakpointHandler,
        'request-and-response-breakpoint': RequestAndResponseBreakpointHandler
    }
);

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