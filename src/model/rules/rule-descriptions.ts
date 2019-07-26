import * as _ from 'lodash';
import { MockRuleData, matchers } from "mockttp";

import { MatcherClass } from "../rules";
import { WildcardMatcher, DefaultWildcardMatcher, MethodMatchers } from './rule-definitions';

function withFirstCharUppercased(input: string): string {
    return input[0].toUpperCase() + input.slice(1);
}

// Summarize a single type of matcher (for listing matcher options)
export function summarizeMatcherClass(matcher: MatcherClass): string | undefined {
    switch (matcher) {
        case WildcardMatcher:
        case DefaultWildcardMatcher:
        case matchers.WildcardMatcher:
            return "Any requests";
        case matchers.MethodMatcher:
            return "Requests using method";
        case matchers.SimplePathMatcher:
            return "For URL";
        case matchers.RegexPathMatcher:
            return "For URLs matching";
        case matchers.QueryMatcher:
            return "With query parameters";
        case matchers.HeaderMatcher:
            return "Including headers";
        case matchers.CookieMatcher:
            return "With cookie";
        case matchers.RawBodyMatcher:
            return "With body";
        case matchers.FormDataMatcher:
            return "With form data";
        case matchers.JsonBodyMatcher:
            return "With JSON body";
        case matchers.JsonBodyFlexibleMatcher:
            return "With JSON body matching";
    }

    // One case to catch the various specific method matchers
    const method = _.findKey(MethodMatchers, m => m === matcher);
    if (method) {
        return `${method} requests`;
    }

    // For anything unknown
    return undefined;
};

// Summarize the matchers of an instantiated rule
export function summarizeMatcher(rule: MockRuleData): string {
    if (rule.matchers.length === 0) return 'Never';
    return matchers.explainMatchers(rule.matchers);
}

// Summarize the action of an instantiated rule
export function summarizeAction(rule: MockRuleData): string {
    return withFirstCharUppercased(rule.handler.explain());
}