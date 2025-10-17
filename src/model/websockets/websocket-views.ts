import { InputWebSocketClose, WebSocketStream } from '../../types';
import { ApiStore } from '../api/api-store';

import { StreamMessage } from '../events/stream-message';
import {
    HttpExchangeView,
    HttpExchangeOriginalView,
    HttpExchangeTransformedView
} from '../http/http-exchange-views';
import { UpstreamWebSocket } from './upstream-websocket';

export interface WebSocketView extends HttpExchangeView {

    get downstream(): WebSocketStream;
    get upstream(): UpstreamWebSocket | undefined;

    get original(): WebSocketView;
    get transformed(): WebSocketView;

    get wasAccepted(): boolean;
    get selectedSubprotocol(): string | undefined;
    get messages(): ReadonlyArray<StreamMessage>;
    get closeState(): InputWebSocketClose | 'aborted' | undefined;

}

export class WebSocketOriginalView extends HttpExchangeOriginalView implements WebSocketView {

    constructor(downstreamWebSocket: WebSocketStream, apiStore: ApiStore) {
        super(downstreamWebSocket, apiStore);
    }

    declare public readonly downstream: WebSocketStream;

    isWebSocket(): this is WebSocketView {
        return true;
    }

    get upstream(): UpstreamWebSocket | undefined {
        return this.downstream.upstream;
    }

    get original(): WebSocketView { return this; }
    get transformed(): WebSocketView { return this.downstream.transformed; }

    get wasAccepted() { return this.downstream.wasAccepted; }
    get selectedSubprotocol() { return this.downstream.selectedSubprotocol; }
    get messages() { return this.downstream.messages; }
    get closeState() { return this.downstream.closeState; }

}

export class WebSocketTransformedView extends HttpExchangeTransformedView implements WebSocketView {

    constructor(exchange: WebSocketStream, apiStore: ApiStore) {
        super(exchange, apiStore);
    }

    declare public readonly downstream: WebSocketStream;

    isWebSocket(): this is WebSocketView {
        return true;
    }

    get upstream(): UpstreamWebSocket | undefined {
        return this.downstream.upstream;
    }

    get original(): WebSocketView { return this.downstream.original; }
    get transformed(): WebSocketView { return this; }

    get wasAccepted() { return this.downstream.wasAccepted; }
    get selectedSubprotocol() { return this.downstream.selectedSubprotocol; }
    get messages() { return this.downstream.messages; }
    get closeState() { return this.downstream.closeState; }

}