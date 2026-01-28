import { ApiStore } from "../api/api-store";
import { StreamMessage } from "../events/stream-message";

import { UpstreamHttpExchange } from "../http/upstream-exchange";
import { WebSocketStream } from "./websocket-stream";
import { WebSocketView } from "./websocket-views";

/**
 * This represents the upstream side of a proxied WebSocket connection. In the websocket
 * case, at the time of writing, the only modifications made during proxying are redirection
 * so this really just proxies through to the downstream side except for the initial
 * upstream connection parameters.
 *
 * By and large this is a minimal PoC & structure for future development - there's very little
 * real usage of this at the moment until we have more WebSocket transformations available.
 */
export class UpstreamWebSocket extends UpstreamHttpExchange implements WebSocketView {

    constructor(downstream: WebSocketStream, apiStore: ApiStore) {
        super(downstream, apiStore);
    }

    isWebSocket(): this is WebSocketView {
        return true;
    }

    declare public readonly downstream: WebSocketStream;

    get upstream(): UpstreamWebSocket {
        return this;
    }

    get original(): WebSocketView {
        return this.downstream.original;
    }

    get transformed(): WebSocketView {
        return this.downstream.transformed;
    }

    get wasAccepted() { return this.downstream.wasAccepted; }
    get selectedSubprotocol() { return this.downstream.selectedSubprotocol; }
    get messages(): readonly StreamMessage[] { return this.downstream.messages; }
    get closeState() { return this.downstream.closeState; }

}