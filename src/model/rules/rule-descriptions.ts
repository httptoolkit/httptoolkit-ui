import * as _ from 'lodash';
import { MockRuleData, matchers } from "mockttp";

import { MatcherClass, HandlerClass } from "./rules";
import {
    WildcardMatcher,
    DefaultWildcardMatcher,
    MethodMatchers,
    StaticResponseHandler,
    ForwardToHostHandler,
    TransformingHandler,
    RequestBreakpointHandler,
    ResponseBreakpointHandler,
    RequestAndResponseBreakpointHandler,
    PassThroughHandler,
    TimeoutHandler,
    CloseConnectionHandler,
    FromFileResponseHandler
} from './rule-definitions';

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
        case matchers.HostMatcher:
            return "For a host";
        case matchers.SimplePathMatcher:
            return "For a URL";
        case matchers.RegexPathMatcher:
            return "For URLs matching";
        case matchers.QueryMatcher:
            return "With query parameters including";
        case matchers.ExactQueryMatcher:
            return "With exact query string";
        case matchers.HeaderMatcher:
            return "Including headers";
        case matchers.CookieMatcher:
            return "With cookie";
        case matchers.RawBodyMatcher:
            return "With exact body";
        case matchers.RawBodyIncludesMatcher:
            return "With body including";
        case matchers.FormDataMatcher:
            return "With form data";
        case matchers.JsonBodyMatcher:
            return "With JSON body";
        case matchers.JsonBodyFlexibleMatcher:
            return "With JSON body including";
    }

    // One case to catch the various specific method matchers
    const method = _.findKey(MethodMatchers, m => m === matcher);
    if (method) {
        return `${method} requests`;
    }

    // For anything unknown
    return undefined;
};

export function summarizeHandlerClass(handler: HandlerClass): string | undefined {
    switch (handler) {
        case StaticResponseHandler:
            return "Return a fixed response";
        case FromFileResponseHandler:
            return "Return a response from a file";
        case ForwardToHostHandler:
            return "Forward the request to a different host";
        case PassThroughHandler:
            return "Pass the request on to its destination";
        case TransformingHandler:
            return "Transform the real request or response automatically";
        case RequestBreakpointHandler:
            return "Pause the request to manually edit it";
        case ResponseBreakpointHandler:
            return "Pause the response to manually edit it";
        case RequestAndResponseBreakpointHandler:
            return "Pause the request & response to manually edit them";
        case TimeoutHandler:
            return "Time out with no response";
        case CloseConnectionHandler:
            return "Close the connection immediately";
        default:
            return undefined;
    }
}

// Summarize the matchers of an instantiated rule
// Slight varation on the Mockttp explanation to make the
// comma positioning more consistent for UX of changing rules
export function summarizeMatcher(rule: MockRuleData): string {
    const { matchers } = rule;

    if (matchers.length === 0) return 'Never';
    if (matchers.length === 1) return matchers[0].explain();
    if (matchers.length === 2) {
        // With just two explanations you can just combine them
        return `${matchers[0].explain()} ${matchers[1].explain()}`;
    }

    // With 3+, we need to oxford comma separate the later
    // explanations, to make them readable
    return matchers[0].explain() + ' ' +
        matchers.slice(1, -1)
        .map((m) => m.explain())
        .join(', ') + ', and ' + matchers.slice(-1)[0].explain();
}

// Summarize the handler of an instantiated rule
export function summarizeHandler(rule: MockRuleData): string {
    return withFirstCharUppercased(rule.handler.explain());
}