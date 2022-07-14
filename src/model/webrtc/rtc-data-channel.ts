import { action, observable } from 'mobx';

import {
    InputRTCDataChannelOpened,
    InputRTCMessage,
    InputRTCDataChannelClosed
} from '../../types';
import { HTKEventBase } from '../events/event-base';

import { DataChannelMessage } from './data-channel-message';
import { RTCConnection } from './rtc-connection';

export class RTCDataChannel extends HTKEventBase {

    constructor(
        private openEvent: InputRTCDataChannelOpened,
        private connection: RTCConnection
    ) {
        super();
    }

    readonly id = this.sessionId + ':data:' + this.channelId;

    isRTCDataChannel(): this is RTCDataChannel {
        return true;
    }

    get rtcConnection() {
        return this.connection;
    }

    get sessionId() {
        return this.rtcConnection.id;
    }

    get channelId() {
        return this.openEvent.channelId;
    }

    get label() {
        return this.openEvent.channelLabel;
    }

    get protocol() {
        return this.openEvent.channelProtocol;
    }

    @observable
    readonly messages: Array<DataChannelMessage> = [];

    @action
    addMessage(message: InputRTCMessage) {
        this.messages.push(new DataChannelMessage(message, this.messages.length));
    }

    @observable
    private closeData: InputRTCDataChannelClosed | undefined;

    @action
    markClosed(closeData: InputRTCDataChannelClosed) {
        this.closeData = closeData;
    }

    get closeState() {
        return this.closeData;
    }

    cleanup() {
        this.messages.forEach(msg => msg.cleanup());
        this.messages.length = 0;
    }

    @observable
    public pinned: boolean = false;

}