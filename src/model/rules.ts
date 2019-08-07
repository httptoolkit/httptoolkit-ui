import * as _ from 'lodash';

import {
    handlers,
    matchers,
    completionCheckers,
    MockRuleData,
} from 'mockttp';

import { Omit } from '../types';

import * as amIUsingHtml from '../amiusing.html';
import {
    MethodMatchers,
    WildcardMatcher,
    StaticResponseHandler,
    AmIUsingMatcher,
    DefaultWildcardMatcher
} from './rules/rule-definitions';

export type HtkMockRule = Omit<MockRuleData, 'matchers'> & {
    id: string;
    matchers: Array<Matcher> & { 0?: InitialMatcher }
};

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

export function getNewRule(): HtkMockRule {
    return {
        id: _.uniqueId(), // Just used for us, for keys
        matchers: [ ],
        completionChecker: new completionCheckers.Always(),
        handler: new StaticResponseHandler(200)
    };
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
        matchers: [new DefaultWildcardMatcher()],
        completionChecker: new completionCheckers.Always(),
        handler: new handlers.PassThroughHandler({
            ignoreHostCertificateErrors: hostWhitelist
        })
    }
];
