import { observable } from 'mobx';

import { InputRawPassthrough, InputRawPassthroughData } from '../types';
import { HTKEventBase } from './events/event-base';
import { StreamMessage } from './events/stream-message';

export interface RawTunnelMessage extends InputRawPassthroughData {
    isBinary: true;
}

export class RawTunnel extends HTKEventBase {

    constructor(
        private openEvent: InputRawPassthrough
    ) {
        super();

        this.searchIndex = [this.upstreamHostname, this.upstreamPort, openEvent.remoteIpAddress]
            .filter((x): x is string => !!x)
            .join('\n');
    }

    readonly id = this.openEvent.id;

    readonly remoteIpAddress = this.openEvent.remoteIpAddress;
    readonly remotePort = this.openEvent.remotePort;

    readonly upstreamHostname = this.openEvent.destination.hostname;
    readonly upstreamPort = this.openEvent.destination.port;

    readonly tags = this.openEvent.tags;
    readonly timingEvents = this.openEvent.timingEvents;

    isRawTunnel(): this is RawTunnel {
        return true;
    }

    readonly packets: StreamMessage[] = [];

    addChunk(dataEvent: InputRawPassthroughData) {
        this.packets.push(
            new StreamMessage(Object.assign(dataEvent, { isBinary: true } as const), this.packets.length)
        );
    }

    @observable
    private open = true;

    markClosed(closeEvent: InputRawPassthrough) {
        this.timingEvents.disconnectTimestamp = closeEvent.timingEvents.disconnectTimestamp;
        this.open = false;
    }

    isOpen() {
        return this.open;
    }

}