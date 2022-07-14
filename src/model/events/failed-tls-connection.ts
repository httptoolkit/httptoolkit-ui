import * as uuid from 'uuid/v4';

import { InputTLSRequest } from '../../types';
import { HTKEventBase } from './event-base';

export class FailedTLSConnection extends HTKEventBase {

    constructor(
        private failureEvent: InputTLSRequest
    ) {
        super();

        this.searchIndex = [failureEvent.hostname, failureEvent.remoteIpAddress]
            .filter((x): x is string => !!x)
            .join('\n')
    }

    readonly id = uuid();

    readonly hostname = this.failureEvent.hostname;
    readonly remoteIpAddress = this.failureEvent.remoteIpAddress;
    readonly remotePort = this.failureEvent.remotePort;
    readonly failureCause = this.failureEvent.failureCause;
    readonly tags = this.failureEvent.tags;
    readonly timingEvents = this.failureEvent.timingEvents;

    isTLSFailure(): this is FailedTLSConnection {
        return true;
    }

}