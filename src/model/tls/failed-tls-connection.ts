import * as uuid from 'uuid/v4';

import { InputTlsFailure } from '../../types';
import { HTKEventBase } from '../events/event-base';

export class FailedTlsConnection extends HTKEventBase {

    constructor(
        private failureEvent: InputTlsFailure
    ) {
        super();

        this.searchIndex = [failureEvent.hostname, failureEvent.remoteIpAddress]
            .filter((x): x is string => !!x)
            .join('\n');
    }

    readonly id = uuid();

    readonly upstreamHostname = this.failureEvent.hostname;
    readonly remoteIpAddress = this.failureEvent.remoteIpAddress;
    readonly remotePort = this.failureEvent.remotePort;
    readonly failureCause = this.failureEvent.failureCause;
    readonly tags = this.failureEvent.tags;
    readonly timingEvents = this.failureEvent.timingEvents;
    readonly tlsMetadata = this.failureEvent.tlsMetadata;

    isTlsFailure(): this is FailedTlsConnection {
        return true;
    }

}