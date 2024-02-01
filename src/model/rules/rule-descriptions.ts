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
        case 'rtc-wildcard':
            return "Any WebRTC connection";

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

        case 'eth-method':
            return "An Ethereum interaction";
        case 'eth-params':
            return "With Ethereum parameters matching";

        case 'ipfs-interaction':
            return "An IPFS interaction";
        case 'ipfs-arg':
            return "With IPFS argument";

        case 'has-rtc-data-channel':
            return "Including a data channel";
        case 'has-rtc-video-track':
            return "Including a video track";
        case 'has-rtc-audio-track':
            return "Including an audio track";
        case 'has-rtc-media-track':
            return "Including any media track";
        case 'rtc-page-hostname':
            return "Sent from a web page on a specific hostname";
        case 'rtc-page-regex':
            return "Sent from a web page matching a URL regex";
        case 'rtc-user-agent-regex':
            return "Sent by a user agent matching a regex";

        case 'am-i-using':
        case 'callback':
        case 'multipart-form-data':
        case 'raw-body-regexp':
        case 'regex-url':
            throw new Error(`${key} handler should not be used directly`);
        default:
            throw new UnreachableCheck(key);
    }
};

export function nameHandlerClass(key: HandlerClassKey): string {
    switch (key) {
        case 'simple':
            return "fixed response";
        case 'file':
            return "file response";
        case 'forward-to-host':
        case 'ws-forward-to-host':
            return "forwarding";
        case 'passthrough':
        case 'ws-passthrough':
            return "passthrough";
        case 'req-res-transformer':
            return "transform";
        case 'request-breakpoint':
        case 'response-breakpoint':
        case 'request-and-response-breakpoint':
            return "breakpoint";
        case 'timeout':
            return "timeout";
        case 'close-connection':
            return "connection close";
        case 'reset-connection':
            return "connection reset";

        case 'ws-reject':
            return "reject";
        case 'ws-listen':
            return "listen";
        case 'ws-echo':
            return "echo";

        case 'eth-call-result':
        case 'eth-number-result':
        case 'eth-hash-result':
        case 'eth-receipt-result':
        case 'eth-block-result':
            return "fixed result";
        case 'eth-error':
            return "error";

        case 'ipfs-cat-text':
        case 'ipfs-add-result':
        case 'ipns-resolve-result':
        case 'ipns-publish-result':
        case 'ipfs-pins-result':
        case 'ipfs-pin-ls-result':
            return "fixed result";
        case 'ipfs-cat-file':
            return "file";

        case 'wait-for-duration':
        case 'wait-for-rtc-data-channel':
        case 'wait-for-rtc-track':
        case 'wait-for-rtc-media':
        case 'wait-for-rtc-message':
        case 'create-rtc-data-channel':
        case 'send-rtc-data-message':
        case 'close-rtc-connection':
        case 'echo-rtc':
        case 'rtc-dynamic-proxy':
            return 'WebRTC';

        case 'json-rpc-response':
        case 'rtc-peer-proxy':
        case 'callback':
        case 'stream':
            throw new Error(`${key} handler should not be used directly`);
        default:
            throw new UnreachableCheck(key);
    }
}

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
            return "Close the connection";
        case 'reset-connection':
            return "Forcibly reset the connection";

        case 'ws-passthrough':
            return "Pass the WebSocket through to its destination";
        case 'ws-forward-to-host':
            return "Forward the WebSocket to a different host";
        case 'ws-reject':
            return "Reject the WebSocket setup request";
        case 'ws-listen':
            return "Accept the WebSocket but send no messages";
        case 'ws-echo':
            return "Echo all messages";

        case 'eth-call-result':
            return "Return a fixed eth_call result";
        case 'eth-number-result':
        case 'eth-hash-result':
            return "Return a fixed value";
        case 'eth-receipt-result':
            return "Return a fixed transaction receipt";
        case 'eth-block-result':
            return "Return fixed Ethereum block data";
        case 'eth-error':
            return "Return an Ethereum error response";

        case 'ipfs-cat-text':
            return "Return fixed IPFS content";
        case 'ipfs-cat-file':
            return "Return IPFS content from a file";
        case 'ipfs-add-result':
            return "Return a fixed IPFS add result";
        case 'ipns-resolve-result':
            return "Return a fixed IPNS resolved address";
        case 'ipns-publish-result':
            return "Return a fixed succesful IPNS result";
        case 'ipfs-pins-result':
            return "Return a fixed IPFS pinning result";
        case 'ipfs-pin-ls-result':
            return "Return a fixed list of IPFS pins";

        case 'wait-for-duration':
            return "Sleep for a given duration";
        case 'wait-for-rtc-data-channel':
            return "Wait for a data channel to be opened";
        case 'wait-for-rtc-track':
            return "Wait for a media track to be opened";
        case 'wait-for-rtc-media':
            return "Wait for any media to be received";
        case 'wait-for-rtc-message':
            return "Wait for a data message to be received";
        case 'create-rtc-data-channel':
            return "Create a data channel";
        case 'send-rtc-data-message':
            return "Send a data message";
        case 'close-rtc-connection':
            return "Close the WebRTC connection";
        case 'echo-rtc':
            return "Echo all messages and media";
        case 'rtc-dynamic-proxy':
            return "Proxy all traffic to the real remote peer";

        case 'json-rpc-response':
        case 'rtc-peer-proxy':
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
        .join(', ') +
        (matchers.length > 3 ? ', and ' : ', ') + // We 'and' only with *many*
        matchers.slice(-1)[0].explain();
}

// Summarize the handler of an instantiated rule
export function summarizeHandler(rule: HtkMockRule): string {
    if ('steps' in rule) {
        const stepExplanations = rule.steps.map(s => s.explain());
        return withFirstCharUppercased(
            stepExplanations.length > 1
            ? (stepExplanations.slice(0, -1).join(', ') + ' then ' + stepExplanations.slice(-1)[0])
            : stepExplanations[0]
        );
    } else {
        return withFirstCharUppercased(rule.handler.explain());
    }
}