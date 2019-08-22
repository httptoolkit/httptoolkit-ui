import * as _ from 'lodash';
import { Method, matchers, handlers } from 'mockttp';
import { PassThroughHandlerOptions } from 'mockttp/dist/rules/handlers';

type MethodName = keyof typeof Method;
const MethodNames = [
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'PATCH',
    'HEAD',
    'OPTIONS'
] as unknown as Array<MethodName>;

// Create per-method classes (that all serialize to the same MethodMatcher class + param)
// for each supported HTTP method, as a methodName -> methodClass lookup object.
export const MethodMatchers = _.reduce<MethodName, {
    [key in MethodName]: { new(): matchers.MethodMatcher }
}>(
    MethodNames,
    (result, method) => {
        result[method] = class SpecificMethodMatcher extends matchers.MethodMatcher {
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
    explain() {
        return 'Any other requests';
    }
}

export class AmIUsingMatcher extends matchers.RegexPathMatcher {

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

    constructor(forwardToLocation: string) {
        super({
            ignoreHostCertificateErrors: ['localhost']
        }, forwardToLocation);
    }

}

export class BreakpointHandler extends handlers.PassThroughHandler {

    constructor(options: Pick<
        PassThroughHandlerOptions, 'beforeRequest' | 'beforeResponse'
    >) {
        super(Object.assign({
            ignoreHostCertificateErrors: ['localhost'],
        }, options));
    }

    explain() {
        if (this.beforeRequest && this.beforeResponse) {
            return "manually rewrite the request and response";
        }
        if (this.beforeRequest) {
            return "manually rewrite the request before it's forwarded";
        }
        if (this.beforeResponse) {
            return "manually rewrite the response before it's returned";
        }
        return super.explain();
    }
}