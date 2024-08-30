import * as _ from 'lodash';
import {
    WebSocketRuleData,
    webSocketHandlerDefinitions as wsHandlers,
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

// Convenient re-export for various built-in handler definitions:
export const {
    EchoWebSocketHandlerDefinition,
    RejectWebSocketHandlerDefinition,
    ListenWebSocketHandlerDefinition
} = wsHandlers;
export type EchoWebSocketHandlerDefinition = wsHandlers.EchoWebSocketHandlerDefinition;
export type RejectWebSocketHandlerDefinition = wsHandlers.RejectWebSocketHandlerDefinition;
export type ListenWebSocketHandlerDefinition = wsHandlers.ListenWebSocketHandlerDefinition;

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

export class WebSocketPassThroughHandler extends wsHandlers.PassThroughWebSocketHandlerDefinition {

    constructor(rulesStore: RulesStore) {
        super(rulesStore.activePassthroughOptions);
    }

}

serializr.createModelSchema(WebSocketPassThroughHandler, {
    type: serializr.primitive()
}, (context) => new WebSocketPassThroughHandler(context.args.rulesStore));

export class WebSocketForwardToHostHandler extends wsHandlers.PassThroughWebSocketHandlerDefinition {

    readonly uiType = 'ws-forward-to-host';

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

serializr.createModelSchema(WebSocketForwardToHostHandler, {
    uiType: serializeAsTag(() => 'ws-forward-to-host'),
    type: serializr.primitive(),
    forwarding: serializr.map(serializr.primitive())
}, (context) => {
    const data = context.json;
    return new WebSocketForwardToHostHandler(
        data.forwarding.targetHost,
        data.forwarding.updateHostHeader,
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

export const WebSocketHandlerLookup = {
    ...wsHandlers.WsHandlerDefinitionLookup,
    'ws-passthrough': WebSocketPassThroughHandler,
    'ws-forward-to-host': WebSocketForwardToHostHandler
};

type WebSocketHandlerClass = typeof WebSocketHandlerLookup[keyof typeof WebSocketHandlerLookup];
type WebSocketHandler = InstanceType<WebSocketHandlerClass>;

export interface WebSocketRule extends Omit<WebSocketRuleData, 'matchers'> {
    id: string;
    type: 'websocket';
    activated: boolean;
    // WebSockets use the same HTTP matchers, but require an initial WebSocket matcher:
    matchers: Array<HttpMatcher> & {
        0?: WebSocketWildcardMatcher | DefaultWebSocketWildcardMatcher
    };
    handler: WebSocketHandler;
    completionChecker: completionCheckers.Always; // HTK rules all *always* match
};