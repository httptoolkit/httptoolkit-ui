import * as _ from 'lodash';
import * as uuid from 'uuid/v4'
import { observable } from 'mobx';
import {
    matchers,
    completionCheckers
} from 'mockttp';
import * as querystring from 'querystring';

import {
    HttpExchange,
    HtkRequest,
    HtkResponse,
    Headers,
} from '../../types';
import { tryParseJson } from '../../util';
import { byteLength } from '../../util/buffer';
import amIUsingHtml from '../../amiusing.html';

import { ProxyStore } from '../proxy-store';
import { versionSatisfies, FROM_FILE_HANDLER_SERVER_RANGE } from '../../services/service-versions';
import { MethodName } from '../http/methods';
import { getStatusMessage } from '../http/http-docs';

import { RulesStore } from './rules-store';
import {
    Handler,
    HtkRule,
    RulePriority,
    InitialMatcher,
    Matcher,
    RuleType,
    isCompatibleMatcher,
    getRulePartKey
} from './rules';
import {
    HtkRuleItem,
    HtkRuleGroup,
    HtkRuleRoot
} from './rules-structure';
import * as HttpRule from './definitions/http-rule-definitions';
import * as WsRule from './definitions/websocket-rule-definitions';
import * as EthRule from './definitions/ethereum-rule-definitions';
import * as IpfsRule from './definitions/ipfs-rule-definitions';
import * as RtcRule from './definitions/rtc-rule-definitions';

export function getNewRule(rulesStore: RulesStore): HtkRule {
    return observable({
        id: uuid(),
        type: 'http', // New rules default to HTTP (i.e. they show HTTP handler options)
        activated: true,
        matchers: [],
        completionChecker: new completionCheckers.Always(),
        handler: getRuleDefaultHandler('http', rulesStore)
    });
}

export function getRuleDefaultMatchers(
    type: RuleType,
    initialMatcher: InitialMatcher,
    existingMatchers?: Matcher[]
) {
    return [
        initialMatcher, // No need to check type - this must match by definition
        ...(existingMatchers || [])
            .slice(1)
            .filter(m => isCompatibleMatcher(m, type))
    ];
}

export function updateRuleAfterInitialMatcherChange(
    rule: HtkRule
) {
    if (rule.type !== 'ipfs') return;

    const ipfsInteraction = rule.matchers[0]?.interactionName;
    if (!ipfsInteraction) return;

    const argMatcherIndex = rule.matchers.findIndex(m => getRulePartKey(m) === 'ipfs-arg');

    if (IpfsRule.shouldSuggestArgMatcher(ipfsInteraction)) {
        const newArgMatcher = new IpfsRule.IpfsArgMatcher(ipfsInteraction, undefined);
        if (argMatcherIndex === -1) {
            rule.matchers.splice(1, 0, newArgMatcher);
        } else {
            rule.matchers.splice(argMatcherIndex, 1, newArgMatcher);
        }
    } else if (argMatcherIndex !== -1) {
        rule.matchers.splice(argMatcherIndex, 1); // Remove the unnecessary arg matcher
    }
}

export function getRuleDefaultHandler(type: 'http', ruleStore: RulesStore): HttpRule.HttpRule['handler'];
export function getRuleDefaultHandler(type: 'websocket', ruleStore: RulesStore): WsRule.WebSocketRule['handler'];
export function getRuleDefaultHandler(type: 'ethereum', ruleStore: RulesStore): EthRule.EthereumRule['handler'];
export function getRuleDefaultHandler(type: 'ipfs', ruleStore: RulesStore): IpfsRule.IpfsRule['handler'];
export function getRuleDefaultHandler(type: 'webrtc', ruleStore: RulesStore): RtcRule.RTCRule['steps'][0];
export function getRuleDefaultHandler(type: RuleType, ruleStore: RulesStore): Handler;
export function getRuleDefaultHandler(type: RuleType, ruleStore: RulesStore): Handler {
    switch (type) {
        case 'http':
            return new HttpRule.PassThroughHandler(ruleStore);
        case 'websocket':
            return new WsRule.WebSocketPassThroughHandler(ruleStore);
        case 'ethereum':
            return new HttpRule.PassThroughHandler(ruleStore);
        case 'ipfs':
            return new HttpRule.PassThroughHandler(ruleStore);
        case 'webrtc':
           return new RtcRule.DynamicProxyStepDefinition();
    }
};

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

    const hasQuery = urlParts.length > 1; // Not just with parameters, but also trailing '?'
    const queryMatcher = hasQuery
        ? [new matchers.QueryMatcher(
            querystring.parse(urlParts.slice(1).join('?')) as ({ [key: string]: string | string[] })
        )]
        : [];

    return [
        new (HttpRule.MethodMatchers[request.method as MethodName] || HttpRule.WildcardMatcher)(),
        new matchers.SimplePathMatcher(path),
        ...queryMatcher,
        ...bodyMatcher
    ];
}

export function buildRuleFromRequest(rulesStore: RulesStore, request: HtkRequest): HtkRule {
    return {
        id: uuid(),
        type: 'http',
        activated: true,
        matchers: buildRequestMatchers(request),
        handler: new HttpRule.RequestBreakpointHandler(rulesStore),
        completionChecker: new completionCheckers.Always(),
    };
}

export function buildRuleFromExchange(exchange: HttpExchange): HtkRule {
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
    const ruleHeaderMatch = Object.assign({}, headers);

    delete ruleHeaderMatch['date'];
    delete ruleHeaderMatch['expires'];
    delete ruleHeaderMatch[':status']; // Pseudoheaders aren't set directly

    // Problematic for the modify rule UI, so skip for now:
    delete ruleHeaderMatch['content-encoding'];

    if (ruleHeaderMatch['content-length']) {
        ruleHeaderMatch['content-length'] = byteLength(bodyContent).toString();
    }

    return {
        id: uuid(),
        type: 'http',
        activated: true,
        matchers: buildRequestMatchers(exchange.request),
        handler: new HttpRule.StaticResponseHandler(
            statusCode,
            statusMessage || getStatusMessage(statusCode),
            bodyContent,
            ruleHeaderMatch
        ),
        completionChecker: new completionCheckers.Always(),
    };
}

export const buildDefaultGroupWrapper = (items: HtkRuleItem[]): HtkRuleGroup => ({
    id: 'default-group',
    title: "Default rules",
    collapsed: true,
    items: items
});

export const buildDefaultGroupRules = (
    rulesStore: RulesStore,
    proxyStore: ProxyStore
): HtkRuleItem[] => [
    // Respond to amiusing.httptoolkit.tech with an emphatic YES
    {
        id: 'default-amiusing',
        type: 'http',
        activated: true,
        priority: RulePriority.OVERRIDE,
        matchers: [
            new HttpRule.MethodMatchers.GET(),
            new HttpRule.AmIUsingMatcher()
        ],
        completionChecker: new completionCheckers.Always(),
        handler: new HttpRule.StaticResponseHandler(200, undefined, amIUsingHtml, {
            'content-type': 'text/html',
            'cache-control': 'no-store',
            'httptoolkit-active': 'true'
        })
    },

    // Share the server certificate on a convenient URL, assuming it supports that
    ...(versionSatisfies(proxyStore.serverVersion, FROM_FILE_HANDLER_SERVER_RANGE)
        ? [{
            id: 'default-certificate',
            type: 'http' as 'http',
            activated: true,
            priority: RulePriority.OVERRIDE,
            matchers: [
                new HttpRule.MethodMatchers.GET(),
                new matchers.SimplePathMatcher("amiusing.httptoolkit.tech/certificate")
            ],
            completionChecker: new completionCheckers.Always(),
            handler: new HttpRule.FromFileResponseHandler(200, undefined, proxyStore.certPath, {
                'content-type': 'application/x-x509-ca-cert'
            })
        }] : []
    ),

    // Pass through all other traffic to the real target
    {
        id: 'default-wildcard',
        type: 'http',
        activated: true,
        matchers: [new HttpRule.DefaultWildcardMatcher()],
        completionChecker: new completionCheckers.Always(),
        handler: new HttpRule.PassThroughHandler(rulesStore)
    },
    {
        id: 'default-ws-wildcard',
        type: 'websocket',
        activated: true,
        matchers: [new WsRule.DefaultWebSocketWildcardMatcher()],
        completionChecker: new completionCheckers.Always(),
        handler: new WsRule.WebSocketPassThroughHandler(rulesStore)
    }
];

export const buildDefaultRulesRoot = (rulesStore: RulesStore, proxyStore: ProxyStore) => ({
    id: 'root',
    title: "HTTP Toolkit Rules",
    isRoot: true,
    items: [
        buildDefaultGroupWrapper(
            buildDefaultGroupRules(rulesStore, proxyStore)
        )
    ]
} as HtkRuleRoot);

export const buildForwardingRuleIntegration = (
    sourceHost: string,
    targetHost: string,
    rulesStore: RulesStore
): HtkRule => ({
    id: 'default-forwarding-rule',
    type: 'http',
    activated: true,
    matchers: [
        new HttpRule.WildcardMatcher(),
        new matchers.HostMatcher(sourceHost)
    ],
    completionChecker: new completionCheckers.Always(),
    handler: new HttpRule.ForwardToHostHandler(targetHost, true, rulesStore)
});