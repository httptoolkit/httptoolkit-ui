import { observable } from 'mobx';

import { InputTlsPassthrough } from '../../types';
import { HTKEventBase } from '../events/event-base';

export class TlsTunnel extends HTKEventBase {

    constructor(
        private openEvent: InputTlsPassthrough
    ) {
        super();

        this.searchIndex = [openEvent.hostname, openEvent.remoteIpAddress]
            .filter((x): x is string => !!x)
            .join('\n');
    }

    readonly id = this.openEvent.id;

    readonly remoteIpAddress = this.openEvent.remoteIpAddress;
    readonly remotePort = this.openEvent.remotePort;

    readonly upstreamHostname = this.openEvent.hostname;
    readonly upstreamPort = this.openEvent.upstreamPort;

    readonly tags = this.openEvent.tags;
    readonly timingEvents = this.openEvent.timingEvents;

    isTlsTunnel(): this is TlsTunnel {
        return true;
    }

    @observable
    private open = true;

    markClosed(closeEvent: InputTlsPassthrough) {
        this.timingEvents.disconnectTimestamp = closeEvent.timingEvents.disconnectTimestamp;
        this.open = false;
    }

    isOpen() {
        return this.open;
    }

}