import * as _ from 'lodash';
import * as uuid from 'uuid/v4';
import { observable } from 'mobx';

import {
    handlers,
    matchers,
    completionCheckers,
    MockRuleData,
} from 'mockttp';

import { Omit } from '../../types';
import { ActivatedStore } from '../interception-store';

import * as amIUsingHtml from '../../amiusing.html';
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
    CloseConnectionHandler
} from './rule-definitions';

export type HtkMockRule = Omit<MockRuleData, 'matchers'> & {
    id: string;
    activated: boolean;
    matchers: Array<Matcher> & { 0?: InitialMatcher };
    handler: Handler;
};

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
        'forward-to-host': ForwardToHostHandler,
        'request-breakpoint': RequestBreakpointHandler,
        'response-breakpoint': ResponseBreakpointHandler,
        'request-and-response-breakpoint': RequestAndResponseBreakpointHandler
    }
);

const PaidHandlerClasses: HandlerClass[] = [
    StaticResponseHandler,
    ForwardToHostHandler,
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

export function getNewRule(interceptionStore: ActivatedStore): HtkMockRule {
    return observable({
        id: uuid(),
        activated: true,
        matchers: [ ],
        completionChecker: new completionCheckers.Always(),
        handler: new PassThroughHandler(interceptionStore.whitelistedCertificateHosts)
    });
}

export const InitialMatcherClasses = [
    WildcardMatcher,
    ...Object.values(MethodMatchers)
];
export type InitialMatcherClass = typeof InitialMatcherClasses[0];
export type InitialMatcher = InstanceType<InitialMatcherClass>;

export const buildDefaultRules = (hostWhitelist: string[]) => [
    // Respond to amiusing.httptoolkit.tech with an emphatic YES
    {
        id: 'default-amiusing',
        activated: true,
        matchers: [
            new MethodMatchers.GET(),
            new AmIUsingMatcher()
        ],
        completionChecker: new completionCheckers.Always(),
        handler: new StaticResponseHandler(200, undefined, amIUsingHtml, {
            'content-type': 'text/html'
        })
    },

    // Pass through all other traffic to the real target
    {
        id: 'default-wildcard',
        activated: true,
        matchers: [new DefaultWildcardMatcher()],
        completionChecker: new completionCheckers.Always(),
        handler: new PassThroughHandler(hostWhitelist)
    }
];

// A more flexible _.isEqual. Considers source-equal functions to be
// equal, and treats undefined properties as missing.
export const ruleEquality = (a: any, b: any): boolean | undefined => {
    // Assume that all function props (e.g. beforeRequest, callbacks)
    // are equivalent if they're source-equivalent.
    // Not a 100% safe guarantee, but should usually be true.
    if (_.isFunction(a) && _.isFunction(b)) {
        return a.toString() === b.toString();
    }

    // For objects with undefined props, pretend those props don't exist:
    if (
        _.isObject(a) && _.isObject(b) && (
            Object.values(a).includes(undefined) ||
            Object.values(b).includes(undefined)
        )
    ) {
        return _.isEqualWith(
            _.omitBy(a, (value) => value === undefined),
            _.omitBy(b, (value) => value === undefined),
            ruleEquality
        );
    }

    // Return undefined -> use standard rules
}