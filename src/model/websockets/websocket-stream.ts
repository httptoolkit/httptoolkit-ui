import * as _ from 'lodash';
import { observable, action, computed } from 'mobx';

import {
    InputRequest,
    InputResponse,
    InputWebSocketMessage,
    InputWebSocketClose,
    InputFailedRequest,
    InputRuleEventDataMap
} from '../../types';

import { ApiStore } from '../api/api-store';
import { StreamMessage } from '../events/stream-message';
import { HttpExchange } from '../http/http-exchange';

import { WebSocketOriginalView, WebSocketTransformedView, WebSocketView } from './websocket-views';
import { UpstreamWebSocket } from './upstream-websocket';

// A websocket stream is an HTTP exchange (the initial setup, or even rejection), but
// may include a series of many ongoing messages and a final websocket close event,
// if the initial websocket connection is successful.
export class WebSocketStream extends HttpExchange implements WebSocketView {

    constructor(request: InputRequest, apiStore: ApiStore) {
        super(request, apiStore);
        this.searchIndex += '\nwebsocket';
    }

    isWebSocket(): this is WebSocketStream {
        return true;
    }

    declare public upstream: UpstreamWebSocket | undefined;

    // These are the same as HttpExchangeViewBase, but need to be copied here (because we're not a _view_,
    // we're original, and TS has no proper mixin support).
    @computed
    get original(): WebSocketView {
        if (!this.upstream) return this;

        // If the request is original, then upstream data matches original data
        // I.e. only possible transform was after all upstream data
        if (!this.upstream.wasRequestTransformed) {
            return this.upstream;
        } else {
            return new WebSocketOriginalView(this.downstream, this.apiStore);
        }
    }

    @computed
    get transformed(): WebSocketView {
        if (!this.upstream) return this;

        // If the response is original, then upstream data matches transformed data
        // I.e. all transforms happened before any upstream data
        if (!this.upstream?.wasResponseTransformed) {
            return this.upstream;
        } else {
            return new WebSocketTransformedView(this.downstream, this.apiStore);
        }
    }

    @observable
    private accepted = false;
    get wasAccepted() { return this.accepted; }

    @observable
    private subprotocol: string | undefined;
    get selectedSubprotocol() { return this.subprotocol; }

    @action
    setAccepted(response: InputResponse) {
        const subprotocolHeader = response.headers['sec-websocket-protocol'];
        if (_.isString(subprotocolHeader)) this.subprotocol = subprotocolHeader;

        this.accepted = true;
        Object.assign(this.timingEvents, response.timingEvents);
    }

    @observable
    readonly messages: Array<StreamMessage> = [];

    @action
    addMessage(message: InputWebSocketMessage) {
        this.messages.push(
            new StreamMessage(message, this.messages.length, this.selectedSubprotocol)
        );
    }

    @observable
    private closeData: InputWebSocketClose | 'aborted' | undefined;

    @action
    markClosed(closeData: InputWebSocketClose) {
        this.closeData = closeData;
        Object.assign(this.timingEvents, closeData.timingEvents);
    }

    get closeState() {
        return this.closeData;
    }

    markAborted(request: InputFailedRequest) {
        if (!this.wasAccepted) {
            // An abort before accept acts exactly as in normal HTTP
            return super.markAborted(request);
        } else {
            // Unlike normal HTTP, websockets can get an abort *after* a successful HTTP
            // response. We handle that as a separate case:
            this.closeData = 'aborted';
            this.searchIndex += '\naborted';
            // Note that we *don't* update this.response - that was still a complete response.

            Object.assign(this.timingEvents, request.timingEvents);
            this.tags = _.union(this.tags, request.tags);
        }
    }

    // The assorted normal upstreamFromUpstream... methods will never be called, as the server side
    // is completely different, so UpstreamHttpExchange will never be populated by the base class.

    updateWithUpstreamConnect(params: InputRuleEventDataMap['passthrough-websocket-connect']) {
        if (!this.upstream) {
            this.upstream = new UpstreamWebSocket(this, this.apiStore);
        }
        this.upstream.updateWithRequestHead(params);
    }

    @action
    clearMessages() {
        // Clear all websocket message data too
        this.messages.forEach(msg => msg.cleanup());
        this.messages.length = 0;
    }

    cleanup() {
        super.cleanup();
        this.clearMessages();
    }
}