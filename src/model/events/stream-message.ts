import { computed, observable } from 'mobx';

import { InputStreamMessage } from "../../types";
import { asBuffer } from '../../util/buffer';

export class StreamMessage {

    @observable
    private inputMessage: InputStreamMessage;

    public readonly cache = observable.map(new Map<symbol, unknown>(), { deep: false });

    constructor(
        inputMessage: InputStreamMessage,
        public readonly messageIndex: number,
        private readonly subprotocol?: string
    ) {
        this.inputMessage = inputMessage;
    }

    /**
     * The direction the message travelled.
     *
     * Note that this may seem reversed! msg.direction is from the perspective
     * of Mockttp, not the client.
     *
     * I.e. 'received' means the client sent it and the proxy received it. Sent
     * means Mockttp sent it to the client (which typically means an upstream
     * server sent it to Mockttp, but it depends on the rule setup).
     */
    get direction() {
        return this.inputMessage.direction;
    }

    @computed
    get content() {
        return asBuffer(this.inputMessage.content);
    }

    get isBinary() {
        return this.inputMessage.isBinary;
    }

    get contentType() {
        if (this.inputMessage.isBinary) {
            if (this.subprotocol?.includes('proto')) {
                return 'protobuf';
            } else {
                return 'raw';
            }
        }

        // prefix+JSON is very common, so we try to parse anything JSON-ish optimistically:
        const startOfMessage = this.content.slice(0, 10).toString('utf-8').trim();
        if (
            startOfMessage.includes('{') ||
            startOfMessage.includes('[') ||
            this.subprotocol?.includes('json')
        ) return 'json';

        else return 'text';
    }

    get timestamp() {
        return this.inputMessage.eventTimestamp;
    }

    cleanup() {
        // As with Exchange & WebSocketStream - in some cases, browsers can keep references to
        // these messages, which causes issues with releasing memory, so we aggressively drop
        // internal references to potentially large data to compensate.
        this.inputMessage.content = Buffer.from([]);
        this.cache.clear();
    }

}