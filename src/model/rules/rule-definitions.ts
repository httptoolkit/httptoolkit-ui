import * as _ from 'lodash';
import { Method, matchers, handlers } from 'mockttp';
import * as serializr from 'serializr';

import { InterceptionStore } from '../interception-store';
import { serializeAsTag } from './rule-serialization';

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

export class PassThroughHandler extends handlers.PassThroughHandler {

    constructor(hostWhitelist: string[]) {
        super({
            ignoreHostCertificateErrors: hostWhitelist
        });
    }

}

export class ForwardToHostHandler extends handlers.PassThroughHandler {

    uiType = 'forward-to-host';

    constructor(forwardToLocation: string, updateHostHeader: boolean) {
        super({
            ignoreHostCertificateErrors: ['localhost'],
            forwarding: {
                targetHost: forwardToLocation,
                updateHostHeader: updateHostHeader
            }
        });
    }

}

export class RequestBreakpointHandler extends handlers.PassThroughHandler {

    constructor(interceptionStore: InterceptionStore) {
        super({
            ignoreHostCertificateErrors: interceptionStore.whitelistedCertificateHosts,
            beforeRequest: interceptionStore.triggerRequestBreakpoint
        });
    }

    explain() {
        return "manually rewrite the request before it's forwarded";
    }
}

serializr.createModelSchema(RequestBreakpointHandler, {
    uiType: serializeAsTag(() => 'request-breakpoint')
}, (context) => new RequestBreakpointHandler(context.args.interceptionStore));

export class ResponseBreakpointHandler extends handlers.PassThroughHandler {

    constructor(interceptionStore: InterceptionStore) {
        super({
            ignoreHostCertificateErrors: interceptionStore.whitelistedCertificateHosts,
            beforeResponse: interceptionStore.triggerResponseBreakpoint
        });
    }

    explain() {
        return "manually rewrite the response before it's returned";
    }
}

serializr.createModelSchema(ResponseBreakpointHandler, {
    uiType: serializeAsTag(() => 'response-breakpoint')
}, (context) => new ResponseBreakpointHandler(context.args.interceptionStore));


export class RequestAndResponseBreakpointHandler extends handlers.PassThroughHandler {

    constructor(interceptionStore: InterceptionStore) {
        super({
            ignoreHostCertificateErrors: interceptionStore.whitelistedCertificateHosts,
            beforeRequest: interceptionStore.triggerRequestBreakpoint,
            beforeResponse: interceptionStore.triggerResponseBreakpoint
        });
    }

    explain() {
        return "manually rewrite the request and response";
    }
}

serializr.createModelSchema(RequestAndResponseBreakpointHandler, {
    uiType: serializeAsTag(() => 'request-and-response-breakpoint')
}, (context) => new RequestAndResponseBreakpointHandler(context.args.interceptionStore));

export type TimeoutHandler = handlers.TimeoutHandler;
export const TimeoutHandler = handlers.TimeoutHandler;
export type CloseConnectionHandler = handlers.CloseConnectionHandler;
export const CloseConnectionHandler = handlers.CloseConnectionHandler;