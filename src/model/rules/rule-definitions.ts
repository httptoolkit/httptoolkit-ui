import * as _ from 'lodash';
import * as uuid from 'uuid/v4'
import { observable } from 'mobx';
import { Method, matchers, handlers, completionCheckers } from 'mockttp';
import * as serializr from 'serializr';

import { InterceptionStore, ActivatedStore } from '../interception-store';
import { serializeAsTag } from '../serialization';

import * as amIUsingHtml from '../../amiusing.html';
import { HtkMockItem, HtkMockRuleGroup, HtkMockRuleRoot, HtkMockRule } from './rules-structure';

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

    constructor(interceptionStore: InterceptionStore) {
        super(interceptionStore.activePassthroughOptions);
    }

}

serializr.createModelSchema(PassThroughHandler, {
    type: serializr.primitive()
}, (context) => new PassThroughHandler(context.args.interceptionStore));

export class ForwardToHostHandler extends handlers.PassThroughHandler {

    constructor(forwardToLocation: string, updateHostHeader: boolean, interceptionStore: InterceptionStore) {
        super({
            ...interceptionStore.activePassthroughOptions,
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
        context.args.interceptionStore
    );
});

export class RequestBreakpointHandler extends handlers.PassThroughHandler {

    constructor(interceptionStore: InterceptionStore) {
        super({
            ...interceptionStore.activePassthroughOptions,
            beforeRequest: interceptionStore.triggerRequestBreakpoint
        });
    }

    explain() {
        return "manually rewrite the request before it's forwarded";
    }
}

serializr.createModelSchema(RequestBreakpointHandler, {
    uiType: serializeAsTag(() => 'request-breakpoint'),
    type: serializr.primitive()
}, (context) => new RequestBreakpointHandler(context.args.interceptionStore));

export class ResponseBreakpointHandler extends handlers.PassThroughHandler {

    constructor(interceptionStore: InterceptionStore) {
        super({
            ...interceptionStore.activePassthroughOptions,
            beforeResponse: interceptionStore.triggerResponseBreakpoint
        });
    }

    explain() {
        return "manually rewrite the response before it's returned";
    }
}

serializr.createModelSchema(ResponseBreakpointHandler, {
    uiType: serializeAsTag(() => 'response-breakpoint'),
    type: serializr.primitive()
}, (context) => new ResponseBreakpointHandler(context.args.interceptionStore));


export class RequestAndResponseBreakpointHandler extends handlers.PassThroughHandler {

    constructor(interceptionStore: InterceptionStore) {
        super({
            ...interceptionStore.activePassthroughOptions,
            beforeRequest: interceptionStore.triggerRequestBreakpoint,
            beforeResponse: interceptionStore.triggerResponseBreakpoint
        });
    }

    explain() {
        return "manually rewrite the request and response";
    }
}

serializr.createModelSchema(RequestAndResponseBreakpointHandler, {
    uiType: serializeAsTag(() => 'request-and-response-breakpoint'),
    type: serializr.primitive()
}, (context) => new RequestAndResponseBreakpointHandler(context.args.interceptionStore));

export type TimeoutHandler = handlers.TimeoutHandler;
export const TimeoutHandler = handlers.TimeoutHandler;
export type CloseConnectionHandler = handlers.CloseConnectionHandler;
export const CloseConnectionHandler = handlers.CloseConnectionHandler;

export function getNewRule(interceptionStore: ActivatedStore): HtkMockRule {
    return observable({
        id: uuid(),
        activated: true,
        matchers: [ ],
        completionChecker: new completionCheckers.Always(),
        handler: new PassThroughHandler(interceptionStore)
    });
}

export const buildDefaultGroup = (...items: HtkMockItem[]): HtkMockRuleGroup => ({
    id: 'default-group',
    title: "Default rules",
    collapsed: true,
    items: items
})

export const buildDefaultRules = (interceptionStore: InterceptionStore) => ({
    id: 'root',
    title: "HTTP Toolkit Rules",
    isRoot: true,
    items: [
        buildDefaultGroup(
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

            // Pass through all other traffic to the real target
            {
                id: 'default-wildcard',
                activated: true,
                matchers: [new DefaultWildcardMatcher()],
                completionChecker: new completionCheckers.Always(),
                handler: new PassThroughHandler(interceptionStore)
            }
        )
    ]
} as HtkMockRuleRoot);

export const buildForwardingRuleIntegration = (
    sourceHost: string,
    targetHost: string,
    interceptionStore: InterceptionStore
): HtkMockRule => ({
    id: 'default-forwarding-rule',
    activated: true,
    matchers: [
        new WildcardMatcher(),
        new matchers.HostMatcher(sourceHost)
    ],
    completionChecker: new completionCheckers.Always(),
    handler: new ForwardToHostHandler(targetHost, true, interceptionStore)
});