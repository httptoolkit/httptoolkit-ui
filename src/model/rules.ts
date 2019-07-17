import * as _ from 'lodash';

import {
    Method,
    handlers,
    matchers,
    completionCheckers,
    MockRuleData
} from 'mockttp';

import * as amIUsingHtml from '../amiusing.html';

function withFirstCharUppercased(input: string): string {
    return input[0].toUpperCase() + input.slice(1);
}

export function summarizeMatcher(rule: MockRuleData): string {
    const firstMatcher = rule.matchers[0];

    // Reformat the explanation for the first matcher to make it noun-y ('for /' to 'Requests for /'),
    // unless it's already been overridden with its own special case.
    const matcherWithNounExplanation = _.some(OverriddenExplanationClasses, c => firstMatcher instanceof c)
        ? firstMatcher
        : { explain: () => `Requests ${firstMatcher.explain()}` } as matchers.RequestMatcher

    return matchers.explainMatchers([matcherWithNounExplanation, ...rule.matchers.slice(1)]);
}

export function summarizeAction(rule: MockRuleData): string {
    return withFirstCharUppercased(rule.handler.explain());
}


class MethodMatcher extends matchers.MethodMatcher {
    explain() {
        return `${Method[this.method]} requests`;
    }
}

class WildcardMatcher extends matchers.WildcardMatcher {
    explain() {
        return 'Any requests';
    }
}

class DefaultWildcardMatcher extends matchers.WildcardMatcher {
    explain() {
        return 'Any other requests';
    }
}

class AmIUsingMatcher extends matchers.RegexPathMatcher {

    constructor() {
        super(/^https?:\/\/amiusing\.httptoolkit\.tech\/?$/);
    }

    explain() {
        return 'for amiusing.httptoolkit.tech';
    }
}

class StaticResponseHandler extends handlers.SimpleHandler {
    explain() {
        return `Respond with status ${this.status} and static content`;
    }
}

const OverriddenExplanationClasses = [
    MethodMatcher,
    WildcardMatcher,
    DefaultWildcardMatcher,
    AmIUsingMatcher,
    StaticResponseHandler
];

export const DefaultRules = {
    amIUsingHTKRule: {
        matchers: [
            new MethodMatcher(Method.GET),
            new AmIUsingMatcher()
        ],
        completionChecker: new completionCheckers.Always(),
        handler: new StaticResponseHandler(200, undefined, amIUsingHtml, { 'content-type': 'text/html' })
    },

    wildcardPassThroughRule: (hostWhitelist: string[]) => ({
        matchers: [new DefaultWildcardMatcher()],
        completionChecker: new completionCheckers.Always(),
        handler: new handlers.PassThroughHandler({
            ignoreHostCertificateErrors: hostWhitelist
        })
    })
};