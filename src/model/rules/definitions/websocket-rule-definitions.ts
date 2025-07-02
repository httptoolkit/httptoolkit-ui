import * as _ from 'lodash';
import {
    WebSocketRuleData,
    webSocketSteps as wsSteps,
    matchers,
    completionCheckers,
    Method
} from 'mockttp';
import * as serializr from 'serializr';

import { RulesStore } from '../rules-store';

import { MethodNames } from '../../http/methods';
import { serializeAsTag } from '../../serialization';
import {
    HttpMatcherLookup,
    HttpMatcher,
    WildcardMatcher
} from './http-rule-definitions';

// Convenient re-export for various built-in step definitions:
export const {
    EchoWebSocketStep,
    RejectWebSocketStep,
    ListenWebSocketStep
} = wsSteps;
export type EchoWebSocketStep = wsSteps.EchoWebSocketStep;
export type RejectWebSocketStep = wsSteps.RejectWebSocketStep;
export type ListenWebSocketStep = wsSteps.ListenWebSocketStep;

export class WebSocketWildcardMatcher extends WildcardMatcher {

    readonly uiType = 'ws-wildcard';

    explain() {
        return 'Any WebSocket';
    }

}

export class DefaultWebSocketWildcardMatcher extends WildcardMatcher {

    readonly uiType = 'default-ws-wildcard';

    explain() {
        return 'Any other WebSockets';
    }
}

export class WebSocketMethodMatcher extends matchers.MethodMatcher {

    explain() {
        return `started with ${Method[this.method]}`;
    }

}

export class WebSocketPassThroughStep extends wsSteps.PassThroughWebSocketStep {

    constructor(rulesStore: RulesStore) {
        super(rulesStore.activePassthroughOptions);
    }

}

serializr.createModelSchema(WebSocketPassThroughStep, {
    type: serializr.primitive()
}, (context) => new WebSocketPassThroughStep(context.args.rulesStore));

export class WebSocketForwardToHostStep extends wsSteps.PassThroughWebSocketStep {

    readonly uiType = 'ws-forward-to-host';

    constructor(protocol: string | undefined, host: string, updateHostHeader: boolean, rulesStore: RulesStore) {
        super({
            ...rulesStore.activePassthroughOptions,
            transformRequest: {
                ...rulesStore.activePassthroughOptions.transformRequest,
                replaceHost: {
                    targetHost: host,
                    updateHostHeader: updateHostHeader
                },
                // If a protocol is specified, we separately redirect to that too:
                ...(protocol ? {
                    setProtocol: protocol as 'ws' | 'wss'
                } : {})
            }
        });
    }

}

serializr.createModelSchema(WebSocketForwardToHostStep, {
    uiType: serializeAsTag(() => 'ws-forward-to-host'),
    type: serializr.primitive(),
    transformRequest: serializr.object(
        serializr.createSimpleSchema({
            setProtocol: serializr.primitive(),
            replaceHost: serializr.raw()
        })
    )
}, (context) => {
    const data = context.json;
    return new WebSocketForwardToHostStep(
        data.transformRequest.setProtocol,
        data.transformRequest.replaceHost.targetHost,
        data.transformRequest.replaceHost.updateHostHeader,
        context.args.rulesStore
    );
});

export const WebSocketMatcherLookup = {
    ..._.omit(HttpMatcherLookup, MethodNames),
    'method': WebSocketMethodMatcher, // Unlike HTTP rules, WS uses a single method matcher

    // Replace the wildcard matchers with our own WebSocket versions:
    'ws-wildcard': WebSocketWildcardMatcher,
    'default-ws-wildcard': DefaultWebSocketWildcardMatcher
};

export const WebSocketInitialMatcherClasses = [
    WebSocketWildcardMatcher
];

export const WebSocketStepLookup = {
    ...wsSteps.WsStepDefinitionLookup,
    'ws-passthrough': WebSocketPassThroughStep,
    'ws-forward-to-host': WebSocketForwardToHostStep
};

type WebSocketStepClass = typeof WebSocketStepLookup[keyof typeof WebSocketStepLookup];
type WebSocketStep = InstanceType<WebSocketStepClass>;

export interface WebSocketRule extends Omit<WebSocketRuleData, 'matchers'> {
    id: string;
    type: 'websocket';
    activated: boolean;
    // WebSockets use the same HTTP matchers, but require an initial WebSocket matcher:
    matchers: Array<HttpMatcher> & {
        0?: WebSocketWildcardMatcher | DefaultWebSocketWildcardMatcher
    };
    steps: Array<WebSocketStep>;
    completionChecker: completionCheckers.Always; // HTK rules all *always* match
};