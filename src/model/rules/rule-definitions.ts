import * as _ from 'lodash';
import * as uuid from 'uuid/v4'
import { observable } from 'mobx';
import { Method, matchers, handlers, completionCheckers } from 'mockttp';
import * as serializr from 'serializr';
import * as querystring from 'querystring';

import {
    HttpExchange,
    HtkRequest,
    HtkResponse,
    Headers,
    MockttpSerializedBuffer
} from '../../types';
import { byteLength, isSerializedBuffer, tryParseJson } from '../../util';
import * as amIUsingHtml from '../../amiusing.html';

import { ProxyStore } from '../proxy-store';
import { versionSatisfies, FROM_FILE_HANDLER_SERVER_RANGE } from '../../services/service-versions';
import { MethodName, MethodNames } from '../http/methods';
import { getStatusMessage } from '../http/http-docs';

import { serializeAsTag, serializeBuffer, serializeWithUndefineds } from '../serialization';
import { RulesStore } from './rules-store';
import {
    HtkMockItem,
    HtkMockRuleGroup,
    HtkMockRuleRoot,
    HtkMockRule,
    CUSTOM_RULE_EQUALS
} from './rules-structure';

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
            byteLength(this.data) ? ' and static content' : ''
        }`;
    }
}

// Ensure that JSON-ified buffers deserialize as real buffers
serializr.createModelSchema(StaticResponseHandler, {
    data: serializr.custom(
        (data: StaticResponseHandler['data']): string | MockttpSerializedBuffer | undefined => {
            if (!data || typeof data === 'string' || isSerializedBuffer(data)) {
                return data;
            } else {
                return { type: 'Buffer', data: [...data] };
            }
        },
        (serializedData: string | MockttpSerializedBuffer | undefined) => {
            if (!serializedData) {
                return undefined;
            } else if (typeof serializedData === 'string') {
                return serializedData;
            } else {
                return Buffer.from(serializedData.data);
            }
        },
    ),
    '*': Object.assign(
        serializr.custom(
            (x) => x,
            (x) => x
        ),
        { pattern: { test: (key: string) => key !== 'data' } }
    )
}, (context) => new StaticResponseHandler(context.args.rulesStore));


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

export type RequestTransform = handlers.RequestTransform;
export type ResponseTransform = handlers.ResponseTransform;

export class TransformingHandler extends handlers.PassThroughHandler {

    constructor(
        rulesStore: RulesStore,
        transformRequest: RequestTransform,
        transformResponse: ResponseTransform
    ) {
        super({
            ...rulesStore.activePassthroughOptions,
            transformRequest,
            transformResponse
        });
    }

    explain() {
        const activeRequestTransforms = _.pickBy(this.transformRequest || {}, (v) => v !== undefined);
        const activeResponseTransforms = _.pickBy(this.transformResponse || {}, (v) => v !== undefined);

        if (_.isEmpty(activeRequestTransforms) && _.isEmpty(activeResponseTransforms)) {
            return super.explain();
        } else if (!_.isEmpty(activeRequestTransforms) && !_.isEmpty(activeResponseTransforms)) {
            return "automatically transform the request and response";
        } else if (!_.isEmpty(activeRequestTransforms)) {
            return "automatically transform the request then pass it through to the target host";
        } else { // Must be response only
            return "automatically transform the response from the target host";
        }
    }

    // We override rule equality checks, to simplify them to treat undefined and missing
    // properties as different, because that matters for various transform properties.
    [CUSTOM_RULE_EQUALS](handlerA: TransformingHandler, handlerB: TransformingHandler): boolean {
        return _.isEqual(handlerA.transformRequest, handlerB.transformRequest) &&
            _.isEqual(handlerA.transformResponse, handlerB.transformResponse);
    }

}

serializr.createModelSchema(TransformingHandler, {
    uiType: serializeAsTag(() => 'req-res-transformer'),
    transformRequest: serializr.object(
        serializr.createSimpleSchema({
            updateHeaders: serializeWithUndefineds,
            updateJsonBody: serializeWithUndefineds,
            replaceBody: serializeBuffer,
            '*': Object.assign(serializr.raw(), { pattern: { test: () => true } })
        })
    ),
    transformResponse: serializr.object(
        serializr.createSimpleSchema({
            updateHeaders: serializeWithUndefineds,
            updateJsonBody: serializeWithUndefineds,
            replaceBody: serializeBuffer,
            '*': Object.assign(serializr.raw(), { pattern: { test: () => true } })
        })
    )
}, (context) => {
    const data = context.json;
    return new TransformingHandler(
        context.args.rulesStore,
        data.transformRequest,
        data.transformResponse
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
    const hasBody = !!request.body.decoded &&
        request.body.decoded.length < 10_000;
    const hasJsonBody = hasBody &&
        request.contentType === 'json' &&
        !!tryParseJson(request.body.decoded!.toString());

    const bodyMatcher = hasJsonBody
        ? [new matchers.JsonBodyMatcher(
            tryParseJson(request.body.decoded!.toString())!
        )]
    : hasBody
        ? [new matchers.RawBodyMatcher(request.body.decoded!.toString())]
    : [];

    const urlParts = request.parsedUrl.toString().split('?');
    const path = urlParts[0];
    const query = urlParts.slice(1).join('?');

    return [
        new (MethodMatchers[request.method as MethodName] || WildcardMatcher)(),
        new matchers.SimplePathMatcher(path),
        new matchers.QueryMatcher(
            querystring.parse(query) as ({ [key: string]: string | string[] })
        ),
        ...bodyMatcher
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
    delete mockRuleHeaders[':status']; // Pseudoheaders aren't set directly

    // Problematic for the mock rule UI, so skip for now:
    delete mockRuleHeaders['content-encoding'];

    if (mockRuleHeaders['content-length']) {
        mockRuleHeaders['content-length'] = byteLength(bodyContent).toString();
    }

    return {
        id: uuid(),
        activated: true,
        matchers: buildRequestMatchers(exchange.request),
        handler: new StaticResponseHandler(
            statusCode,
            statusMessage || getStatusMessage(statusCode),
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

export const buildDefaultRules = (rulesStore: RulesStore, proxyStore: ProxyStore) => ({
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
            ...(versionSatisfies(proxyStore.serverVersion, FROM_FILE_HANDLER_SERVER_RANGE)
                ? [{
                    id: 'default-certificate',
                    activated: true,
                    matchers: [
                        new MethodMatchers.GET(),
                        new matchers.SimplePathMatcher("amiusing.httptoolkit.tech/certificate")
                    ],
                    completionChecker: new completionCheckers.Always(),
                    handler: new FromFileResponseHandler(200, undefined, proxyStore.certPath, {
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