import {
    WebSocketRuleData,
    webSocketHandlerDefinitions as wsHandlers,
    completionCheckers
} from 'mockttp';
import * as serializr from 'serializr';

import { RulesStore } from '../rules-store';
import {
    HttpMatcherLookup,
    HttpMatcher,
    WildcardMatcher
} from './http-rule-definitions';

export class WebSocketWildcardMatcher extends WildcardMatcher {

    uiType = 'ws-wildcard';

    explain() {
        return 'Any WebSocket';
    }

}

export class DefaultWebSocketWildcardMatcher extends WebSocketWildcardMatcher {

    uiType = 'default-ws-wildcard';

    explain() {
        return 'Any other WebSockets';
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

export const WebSocketMatcherLookup = {
    ...HttpMatcherLookup,
    // Replace the wildcard matchers with our own WebSocket versions:
    'ws-wildcard': WebSocketWildcardMatcher,
    'default-ws-wildcard': DefaultWebSocketWildcardMatcher
};

export const WebSocketHandlerLookup = {
    ...wsHandlers.WsHandlerDefinitionLookup,
    'ws-passthrough': WebSocketPassThroughHandler
};

type WebSocketHandlerClass = typeof WebSocketHandlerLookup[keyof typeof WebSocketHandlerLookup];
type WebSocketHandler = InstanceType<WebSocketHandlerClass>;

export interface WebSocketMockRule extends Omit<WebSocketRuleData, 'matchers'> {
    id: string;
    type: 'websocket';
    activated: boolean;
    // WebSockets use the same HTTP matchers, but require an initial WebSocket matcher:
    matchers: Array<HttpMatcher> & { 0?: WebSocketWildcardMatcher };
    handler: WebSocketHandler;
    completionChecker: completionCheckers.Always; // HTK rules all *always* match
};