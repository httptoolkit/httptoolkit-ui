/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { action, observable } from 'mobx';

import {
    InputRTCDataChannelOpened,
    InputRTCMessage,
    InputRTCDataChannelClosed
} from '../../types';
import { HTKEventBase } from '../events/event-base';
import { StreamMessage } from '../events/stream-message';

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
    readonly messages: Array<StreamMessage> = [];

    @action
    addMessage(message: InputRTCMessage) {
        this.messages.push(new StreamMessage(message, this.messages.length));
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

}