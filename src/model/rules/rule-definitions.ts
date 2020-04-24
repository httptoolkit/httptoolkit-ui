import * as _ from 'lodash';
import * as uuid from 'uuid/v4'
import { observable } from 'mobx';
import { Method, matchers, handlers, completionCheckers } from 'mockttp';
import * as serializr from 'serializr';
import * as semver from 'semver';

import { RulesStore } from './rules-store';
import { serializeAsTag } from '../serialization';

import * as amIUsingHtml from '../../amiusing.html';
import { HtkMockItem, HtkMockRuleGroup, HtkMockRuleRoot, HtkMockRule } from './rules-structure';
import { ServerStore } from '../server-store';
import { FROM_FILE_HANDLER_SERVER_RANGE } from '../../services/service-versions';
import { HtkResponse, Headers, HtkRequest } from '../../types';
import { HttpExchange } from '../http/exchange';

type MethodName = keyof typeof Method;
const MethodNames = Object.values(Method)
    .filter(
        value => typeof value === 'string'
    ) as Array<MethodName>;

// Create per-method classes (that all serialize to the same MethodMatcher class + param)
// for each supported HTTP method, as a methodName -> methodClass lookup object.
export const MethodMatchers = _.reduce<MethodName, {
    [key in MethodName]: { new(): matchers.MethodMatcher }
}>(
    MethodNames,
    (result, method) => {
        result[method] = class SpecificMethodMatcher extends matchers.MethodMatcher {

            uiType = method;

            constructor() {
                super(Method[method]);
            }

            explain() {
                return `${Method[this.method]} requests`;
            }
        };
        return result;
    },
    {} as any
);

// Override various specific & actions, so we can inject our own specific
// explanations for certain cases

export class WildcardMatcher extends matchers.WildcardMatcher {
    explain() {
        return 'Any requests';
    }
}

export class DefaultWildcardMatcher extends matchers.WildcardMatcher {

    uiType = 'default-wildcard';

    explain() {
        return 'Any other requests';
    }
}

export class AmIUsingMatcher extends matchers.RegexPathMatcher {

    uiType = 'am-i-using';

    constructor() {
        // Optional slash is for backward compat: for server 0.1.18+ it's always present
        super(/^https?:\/\/amiusing\.httptoolkit\.tech\/?$/);
    }

    explain() {
        return 'for amiusing.httptoolkit.tech';
    }
}

export class StaticResponseHandler extends handlers.SimpleHandler {
    explain() {
        return `respond with status ${this.status}${
            this.data ? ' and static content' : ''
        }`;
    }
}

export class FromFileResponseHandler extends handlers.FileHandler {
    explain() {
        return `respond with status ${this.status} and content from ${this.filePath || 'a file'}`;
    }
}

export class PassThroughHandler extends handlers.PassThroughHandler {

    constructor(rulesStore: RulesStore) {
        super(rulesStore.activePassthroughOptions);
    }

}

serializr.createModelSchema(PassThroughHandler, {
    type: serializr.primitive()
}, (context) => new PassThroughHandler(context.args.rulesStore));

export class ForwardToHostHandler extends handlers.PassThroughHandler {

    constructor(forwardToLocation: string, updateHostHeader: boolean, rulesStore: RulesStore) {
        super({
            ...rulesStore.activePassthroughOptions,
            forwarding: {
                targetHost: forwardToLocation,
                updateHostHeader: updateHostHeader
            }
        });
    }

}

serializr.createModelSchema(ForwardToHostHandler, {
    uiType: serializeAsTag(() => 'forward-to-host'),
    type: serializr.primitive(),
    forwarding: serializr.map(serializr.primitive())
}, (context) => {
    const data = context.json;
    return new ForwardToHostHandler(
        data.forwarding.targetHost,
        data.forwarding.updateHostHeader,
        context.args.rulesStore
    );
});

export class RequestBreakpointHandler extends handlers.PassThroughHandler {

    constructor(rulesStore: RulesStore) {
        super({
            ...rulesStore.activePassthroughOptions,
            beforeRequest: rulesStore.triggerRequestBreakpoint
        });
    }

    explain() {
        return "manually rewrite the request before it's forwarded";
    }
}

serializr.createModelSchema(RequestBreakpointHandler, {
    uiType: serializeAsTag(() => 'request-breakpoint'),
    type: serializr.primitive()
}, (context) => new RequestBreakpointHandler(context.args.rulesStore));

export class ResponseBreakpointHandler extends handlers.PassThroughHandler {

    constructor(rulesStore: RulesStore) {
        super({
            ...rulesStore.activePassthroughOptions,
            beforeResponse: rulesStore.triggerResponseBreakpoint
        });
    }

    explain() {
        return "manually rewrite the response before it's returned";
    }
}

serializr.createModelSchema(ResponseBreakpointHandler, {
    uiType: serializeAsTag(() => 'response-breakpoint'),
    type: serializr.primitive()
}, (context) => new ResponseBreakpointHandler(context.args.rulesStore));


export class RequestAndResponseBreakpointHandler extends handlers.PassThroughHandler {

    constructor(rulesStore: RulesStore) {
        super({
            ...rulesStore.activePassthroughOptions,
            beforeRequest: rulesStore.triggerRequestBreakpoint,
            beforeResponse: rulesStore.triggerResponseBreakpoint
        });
    }

    explain() {
        return "manually rewrite the request and response";
    }
}

serializr.createModelSchema(RequestAndResponseBreakpointHandler, {
    uiType: serializeAsTag(() => 'request-and-response-breakpoint'),
    type: serializr.primitive()
}, (context) => new RequestAndResponseBreakpointHandler(context.args.rulesStore));

export type TimeoutHandler = handlers.TimeoutHandler;
export const TimeoutHandler = handlers.TimeoutHandler;
export type CloseConnectionHandler = handlers.CloseConnectionHandler;
export const CloseConnectionHandler = handlers.CloseConnectionHandler;

export function getNewRule(rulesStore: RulesStore): HtkMockRule {
    return observable({
        id: uuid(),
        activated: true,
        matchers: [ ],
        completionChecker: new completionCheckers.Always(),
        handler: new PassThroughHandler(rulesStore)
    });
}

function buildRequestMatchers(request: HtkRequest) {
    return [
        new MethodMatchers[request.method as MethodName]() || new WildcardMatcher(),
        new matchers.SimplePathMatcher(request.parsedUrl.toString().split('?')[0])
    ];
}

export function buildRuleFromRequest(rulesStore: RulesStore, request: HtkRequest): HtkMockRule {
    return {
        id: uuid(),
        activated: true,
        matchers: buildRequestMatchers(request),
        handler: new RequestBreakpointHandler(rulesStore),
        completionChecker: new completionCheckers.Always(),
    };
}

export function buildRuleFromExchange(exchange: HttpExchange): HtkMockRule {
    const { statusCode, statusMessage, headers } = exchange.isSuccessfulExchange()
        ? exchange.response
        : { statusCode: 200, statusMessage: "OK", headers: {} as Headers };

    const useResponseBody = (
        exchange.isSuccessfulExchange() &&
        // Don't include automatically include the body if it's too large
        // for manual editing (> 1MB), just for UX reasons
        exchange.response.body.encoded.byteLength <= 1024 * 1024 &&
        !!exchange.response.body.decoded // If we can't decode it, don't include it
    );

    const bodyContent = useResponseBody
        ? (exchange.response as HtkResponse).body.decoded!
        : "A mock response";

    // Copy headers so we can mutate them independently:
    const mockRuleHeaders = Object.assign({}, headers);

    delete mockRuleHeaders['date'];
    delete mockRuleHeaders['expires'];

    // Problematic for the mock rule UI, so skip for now:
    delete mockRuleHeaders['content-encoding'];

    if (mockRuleHeaders['content-length']) {
        mockRuleHeaders['content-length'] = bodyContent.length.toString();
    }

    return {
        id: uuid(),
        activated: true,
        matchers: buildRequestMatchers(exchange.request),
        handler: new StaticResponseHandler(
            statusCode,
            statusMessage,
            bodyContent,
            mockRuleHeaders
        ),
        completionChecker: new completionCheckers.Always(),
    };
}

export const buildDefaultGroup = (items: HtkMockItem[]): HtkMockRuleGroup => ({
    id: 'default-group',
    title: "Default rules",
    collapsed: true,
    items: items
})

export const buildDefaultRules = (rulesStore: RulesStore, serverStore: ServerStore) => ({
    id: 'root',
    title: "HTTP Toolkit Rules",
    isRoot: true,
    items: [
        buildDefaultGroup([
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
                    'content-type': 'text/html',
                    'httptoolkit-active': 'true'
                })
            },

            // Share the server certificate on a convenient URL, assuming it supports that
            ...(semver.satisfies(serverStore.serverVersion, FROM_FILE_HANDLER_SERVER_RANGE)
                ? [{
                    id: 'default-certificate',
                    activated: true,
                    matchers: [
                        new MethodMatchers.GET(),
                        new matchers.SimplePathMatcher("amiusing.httptoolkit.tech/certificate")
                    ],
                    completionChecker: new completionCheckers.Always(),
                    handler: new FromFileResponseHandler(200, undefined, serverStore.certPath, {
                        'content-type': 'application/x-x509-ca-cert'
                    })
                }] : []
            ),

            // Pass through all other traffic to the real target
            {
                id: 'default-wildcard',
                activated: true,
                matchers: [new DefaultWildcardMatcher()],
                completionChecker: new completionCheckers.Always(),
                handler: new PassThroughHandler(rulesStore)
            }
        ])
    ]
} as HtkMockRuleRoot);

export const buildForwardingRuleIntegration = (
    sourceHost: string,
    targetHost: string,
    rulesStore: RulesStore
): HtkMockRule => ({
    id: 'default-forwarding-rule',
    activated: true,
    matchers: [
        new WildcardMatcher(),
        new matchers.HostMatcher(sourceHost)
    ],
    completionChecker: new completionCheckers.Always(),
    handler: new ForwardToHostHandler(targetHost, true, rulesStore)
});