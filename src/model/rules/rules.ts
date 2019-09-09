import * as _ from 'lodash';
import { observable } from 'mobx';

import {
    handlers,
    matchers,
    completionCheckers,
    MockRuleData,
} from 'mockttp';

import { Omit } from '../../types';

import * as amIUsingHtml from '../../amiusing.html';
import {
    MethodMatchers,
    WildcardMatcher,
    StaticResponseHandler,
    AmIUsingMatcher,
    DefaultWildcardMatcher,
    ForwardToHostHandler,
    PassThroughHandler,
    BreakpointHandler
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
    { wildcard: WildcardMatcher } // Replace the wildcard matcher with our own
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
        'breakpoint': BreakpointHandler
    }
);

export type HandlerClassKey = keyof typeof HandlerLookup;
export type HandlerClass = typeof HandlerLookup[HandlerClassKey];
export type Handler = InstanceType<HandlerClass>;

export const HandlerKeys = new Map<HandlerClass, HandlerClassKey>(
    Object.entries(HandlerLookup)
    .map(
        ([key, handler]) => [handler, key]
    ) as Array<[HandlerClass, HandlerClassKey]>
);

export function getNewRule(): HtkMockRule {
    return observable({
        id: _.uniqueId(), // Just used for us, for keys
        activated: true,
        matchers: [ ],
        completionChecker: new completionCheckers.Always(),
        handler: new StaticResponseHandler(200)
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
