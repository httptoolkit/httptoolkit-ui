import * as _ from 'lodash';
import { observable, action } from 'mobx';

import {
    InputInitiatedRequest,
    InputRequest,
    InputResponse,
    InputWebSocketMessage,
    InputWebSocketClose,
    InputFailedRequest
} from '../../types';

import { ApiStore } from '../api/api-store';
import { StreamMessage } from '../events/stream-message';
import { HttpExchange } from '../http/exchange';

// A websocket stream is an HTTP exchange (the initial setup, or even rejection), but
// may include a series of many ongoing messages and a final websocket close event,
// if the initial websocket connection is successful.
export class WebSocketStream extends HttpExchange {
    constructor(apiStore: ApiStore, request: InputRequest) {
        super(apiStore, request);
        this.searchIndex += '\nwebsocket';
    }

    isWebSocket(): this is WebSocketStream {
        return true;
    }

    @observable
    private accepted = false;

    @observable
    private subprotocol: string | undefined;

    @action
    setAccepted(response: InputResponse) {
        const subprotocolHeader = response.headers['sec-websocket-protocol'];
        if (_.isString(subprotocolHeader)) this.subprotocol = subprotocolHeader;

        this.accepted = true;
        Object.assign(this.timingEvents, response.timingEvents);
    }

    wasAccepted() {
        return this.accepted;
    }

    get selectedSubprotocol() {
        return this.subprotocol;
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
        if (!this.wasAccepted()) {
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

    cleanup() {
        super.cleanup();

        // Clear all websocket message data too
        this.messages.forEach(msg => msg.cleanup());
        this.messages.length = 0;
    }
}