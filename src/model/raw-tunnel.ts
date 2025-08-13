import { action, observable } from 'mobx';

import { InputRawPassthrough, InputRawPassthroughData } from '../types';
import { HTKEventBase } from './events/event-base';
import { StreamMessage } from './events/stream-message';

export interface RawTunnelMessage extends InputRawPassthroughData {
    isBinary: true;
}

const PACKET_COMBINE_LIMIT = 500_000;

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

    @observable
    readonly packets: StreamMessage[] = [];

    @action
    addChunk(dataEvent: InputRawPassthroughData) {
        const lastPacket = this.packets[this.packets.length - 1] as StreamMessage | undefined;

        // Combine together small sequential packets from the same client within 10ms, to
        // simplify & clarify busy streams
        if (
            lastPacket?.direction === dataEvent.direction &&
            (dataEvent.eventTimestamp - lastPacket.timestamp < 10) &&
            lastPacket.content.byteLength + dataEvent.content.byteLength < PACKET_COMBINE_LIMIT
        ) {
            this.packets[this.packets.length - 1] = new StreamMessage(
                {
                    id: this.id,
                    direction: lastPacket.direction,
                    eventTimestamp: lastPacket.timestamp, // Use the first packet in the chunk's timestamp
                    content: Buffer.concat([lastPacket.content, dataEvent.content]),
                    isBinary: true
                },
                this.packets.length
            );
            return;
        }

        this.packets.push(
            new StreamMessage(Object.assign(dataEvent, { isBinary: true } as const), this.packets.length)
        );
    }

    @observable
    private open = true;

    @action
    markClosed(closeEvent: InputRawPassthrough) {
        this.timingEvents.disconnectTimestamp = (
            // Work around for incorrect timing field name:
            (closeEvent.timingEvents as any).disconnectedTimestamp ||
            closeEvent.timingEvents.disconnectTimestamp
        );
        this.open = false;
    }

    isOpen() {
        return this.open;
    }

}