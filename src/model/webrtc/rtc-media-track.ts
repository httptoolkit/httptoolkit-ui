import { action, observable } from 'mobx';

import {
    InputRTCMediaTrackOpened,
    InputRTCMediaStats,
    InputRTCMediaTrackClosed
} from '../../types';
import { HTKEventBase } from '../events/event-base';

import { RTCConnection } from './rtc-connection';

export class RTCMediaTrack extends HTKEventBase {

    constructor(
        private openEvent: InputRTCMediaTrackOpened,
        private connection: RTCConnection
    ) {
        super();
    }

    readonly id = this.sessionId + ':media:' + this.mid;

    isRTCMediaTrack() {
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
    readonly stats: Array<InputRTCMediaStats> = [];

    @action
    addStats(message: InputRTCMediaStats) {
        this.stats.push(message);
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

    @observable
    public pinned: boolean = false;

}