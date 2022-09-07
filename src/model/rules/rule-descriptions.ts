import * as _ from 'lodash';

import { UnreachableCheck } from '../../util/error';

import {
    HtkMockRule,
    RuleType,
    HandlerClassKey,
    MatcherClassKey
} from "./rules";
import {
    MethodMatchers
} from './definitions/http-rule-definitions';

function withFirstCharUppercased(input: string): string {
    return input[0].toUpperCase() + input.slice(1);
}

const isMethod = (key: any): key is keyof typeof MethodMatchers => {
    return key in MethodMatchers;
};

// Summarize a single type of matcher (for listing matcher options)
export function summarizeMatcherClass(key: MatcherClassKey): string {
    if (isMethod(key)) return `${key} requests`;

    switch (key) {
        case 'wildcard':
        case 'default-wildcard':
            return "Any requests";
        case 'ws-wildcard':
        case 'default-ws-wildcard':
            return 'Any WebSocket';
        case 'method':
            return "Sent with HTTP method";
        case 'host':
            return "For a host";
        case 'simple-path':
            return "For a URL";
        case 'regex-path':
            return "For URLs matching";
        case 'query':
            return "With query parameters including";
        case 'exact-query-string':
            return "With exact query string";
        case 'header':
            return "Including headers";
        case 'cookie':
            return "With cookie";
        case 'raw-body':
            return "With exact body";
        case 'raw-body-includes':
            return "With body including";
        case 'form-data':
            return "With form data";
        case 'json-body':
            return "With JSON body";
        case 'json-body-matching':
            return "With JSON body including";
        case 'protocol':
            return "With protocol";
        case 'port':
            return "For port";
        case 'hostname':
            return "For hostname";
        case 'am-i-using':
        case 'callback':
        case 'multipart-form-data':
        case 'raw-body-regexp':
            throw new Error(`${key} handler should not be used directly`);
        default:
            throw new UnreachableCheck(key);
    }
};

export function summarizeHandlerClass(key: HandlerClassKey): string {
    switch (key) {
        case 'simple':
            return "Return a fixed response";
        case 'file':
            return "Return a response from a file";
        case 'forward-to-host':
            return "Forward the request to a different host";
        case 'passthrough':
            return "Pass the request on to its destination";
        case 'ws-passthrough':
            return "Pass the WebSocket through to its destination";
        case 'req-res-transformer':
            return "Transform the real request or response automatically";
        case 'request-breakpoint':
            return "Pause the request to manually edit it";
        case 'response-breakpoint':
            return "Pause the response to manually edit it";
        case 'request-and-response-breakpoint':
            return "Pause the request & response to manually edit them";
        case 'timeout':
            return "Time out with no response";
        case 'close-connection':
            return "Close the connection immediately";
        case 'ws-reject':
            return "Reject the WebSocket setup request";
        case 'ws-listen':
            return "Accept the WebSocket but send no messages";
        case 'ws-echo':
            return "Echo all messages";
        case 'callback':
        case 'stream':
            throw new Error(`${key} handler should not be used directly`);
        default:
            throw new UnreachableCheck(key);
    }
}

// Summarize the matchers of an instantiated rule
// Slight varation on the Mockttp explanation to make the
// comma positioning more consistent for UX of changing rules
export function summarizeMatcher(rule: HtkMockRule): string {
    const { matchers } = rule;

    if (matchers.length === 0) return 'Never';
    if (matchers.length === 1) return matchers[0]!.explain();
    if (matchers.length === 2) {
        // With just two explanations you can just combine them
        return `${matchers[0]!.explain()} ${matchers[1].explain()}`;
    }

    // With 3+, we need to oxford comma separate the later
    // explanations, to make them readable
    return matchers[0]!.explain() + ' ' +
        matchers.slice(1, -1)
        .map((m) => m.explain())
        .join(', ') + ', and ' + matchers.slice(-1)[0].explain();
}

// Summarize the handler of an instantiated rule
export function summarizeHandler(rule: HtkMockRule): string {
    return withFirstCharUppercased(rule.handler.explain());
}