/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import _ from 'lodash';
import { action, observable, computed } from 'mobx';

import {
    InputRTCMediaTrackOpened,
    InputRTCMediaStats,
    InputRTCMediaTrackClosed
} from '../../types';
import { HTKEventBase } from '../events/event-base';

import { RTCConnection } from './rtc-connection';

export interface RTCMediaStatEvent {
    timestamp: number;

    sentDelta: number;
    receivedDelta: number;
}

export class RTCMediaTrack extends HTKEventBase {

    constructor(
        private openEvent: InputRTCMediaTrackOpened,
        private connection: RTCConnection
    ) {
        super();
    }

    readonly id = this.sessionId + ':media:' + this.mid;

    isRTCMediaTrack(): this is RTCMediaTrack {
        return true;
    }

    get rtcConnection() {
        return this.connection;
    }

    get sessionId() {
        return this.rtcConnection.id;
    }

    get mid() {
        return this.openEvent.trackMid;
    }

    get direction() {
        return this.openEvent.trackDirection;
    }

    get type() {
        return this.openEvent.trackType;
    }

    @observable
    readonly stats: Array<RTCMediaStatEvent> = [];

    @action
    addStats(event: InputRTCMediaStats) {
        const previousEvent: RTCMediaStatEvent | undefined = this.stats[this.stats.length - 1];

        if (previousEvent?.timestamp < event.eventTimestamp - 1500) { // If we've missed some events:
            const skippedEventCount = Math.round((event.eventTimestamp - previousEvent.timestamp) / 1000) - 1;

            if (skippedEventCount > 0) {
                // No stats are sent when there's no traffic. If we now have traffic, we need to backfill
                // skipped events with zeros to give us a complete timeline:
                this.stats.push(
                    ..._.range(previousEvent.timestamp + 1000, event.eventTimestamp - 500, 1000)
                    .map(timestamp => ({ timestamp, sentDelta: 0, receivedDelta: 0 }))
                );
            }
        }

        this.stats.push({
            timestamp: event.eventTimestamp,
            sentDelta: event.totalBytesSent - this.totalBytesSent,
            receivedDelta: event.totalBytesReceived - this.totalBytesReceived
        });

        this._totalBytesSent = event.totalBytesSent;
        this._totalBytesReceived = event.totalBytesReceived;
    }

    @observable
    private _totalBytesSent: number = 0;

    get totalBytesSent() {
        return this._totalBytesSent;
    }

    @observable
    private _totalBytesReceived: number = 0;

    get totalBytesReceived() {
        return this._totalBytesReceived;
    }

    @observable
    private closeData: InputRTCMediaTrackClosed | undefined;

    @action
    markClosed(closeData: InputRTCMediaTrackClosed) {
        this.closeData = closeData;
    }

    get closeState() {
        return this.closeData;
    }

    cleanup() {
        this.stats.length = 0;
    }

}