import * as _ from 'lodash';
import { observable, action } from 'mobx';

import {
    InputRequest,
    InputResponse
} from '../../types';

import { ApiStore } from '../api/api-store';
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
    }

    wasAccepted() {
        return this.accepted;
    }

    get selectedSubprotocol() {
        return this.subprotocol;
    }
}