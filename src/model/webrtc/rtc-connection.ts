/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { action, observable, computed } from "mobx";
import { SelectedRTCCandidate } from "mockrtc";

import {
    InputRTCPeerConnected,
    InputRTCExternalPeerAttached,
    InputRTCPeerDisconnected,
    RTCStream
} from "../../types";
import { HTKEventBase } from "../events/event-base";
import { parseSource } from "../http/sources";
import { ObservableCache } from "../observable-cache";

const candidateToUrl = (candidate: SelectedRTCCandidate) =>
    `${candidate.protocol}://${candidate.address}:${candidate.port}`;

export class RTCConnection extends HTKEventBase {

    constructor(
        private connectionEvent: InputRTCPeerConnected
    ) {
        super();
    }

    readonly id = this.connectionEvent.sessionId;

    isRTCConnection(): this is RTCConnection  {
        return true;
    }

    get peerId() {
        return this.connectionEvent.peerId;
    }

    get localSessionDescription() {
        return this.connectionEvent.localSessionDescription;
    }

    get remoteSessionDescription() {
        return this.connectionEvent.remoteSessionDescription;
    }

    @computed
    get source() {
        return parseSource(this.connectionEvent.metadata.userAgent);
    }

    @computed
    get sourceURL() {
        if (!this.connectionEvent.metadata.sourceURL) return undefined;

        try {
            return new URL(this.connectionEvent.metadata.sourceURL);
        } catch (e) {
            return undefined;
        }
    }

    @computed
    get clientURL() {
        return candidateToUrl(this.connectionEvent.selectedRemoteCandidate);
    }

    @observable
    private attachedConnection:
        | {
            externalConnection: InputRTCExternalPeerAttached['externalConnection'],
            otherHalf?: RTCConnection
        }
        | undefined;

    @action
    attachExternalPeer(
        attachEvent: InputRTCExternalPeerAttached,
        otherHalf: RTCConnection | undefined
    ) {
        this.attachedConnection = {
            externalConnection: attachEvent.externalConnection,
            otherHalf
        };
    }

    isOtherHalfOf(attachEvent: InputRTCExternalPeerAttached) {
        if (!this.attachedConnection) return false;

        const { externalConnection: ourExternalConnection } = this.attachedConnection;
        const { externalConnection: theirExternalConnection } = attachEvent;

        const ourExternalAddress = candidateToUrl(ourExternalConnection.selectedLocalCandidate);
        const ourRemoteAddress = candidateToUrl(ourExternalConnection.selectedRemoteCandidate);

        const theirExternalAddress = candidateToUrl(theirExternalConnection.selectedLocalCandidate);
        const theirRemoteAddress = candidateToUrl(theirExternalConnection.selectedRemoteCandidate);

        return ourExternalAddress === theirRemoteAddress &&
            theirExternalAddress === ourRemoteAddress;
    }

    @action
    connectOtherHalf(otherHalf: RTCConnection) {
        this.attachedConnection!.otherHalf = otherHalf;
    }

    @computed
    get remoteCandidate() {
        if (!this.attachedConnection) return this.connectionEvent.selectedLocalCandidate;

        const { externalConnection, otherHalf } = this.attachedConnection;

        if (otherHalf) {
            return otherHalf.connectionEvent.selectedRemoteCandidate;
        } else {
            return externalConnection.selectedRemoteCandidate;
        }
    }

    @computed
    get remoteURL() {
        return candidateToUrl(this.remoteCandidate);
    }

    readonly streams = observable.array<RTCStream>([], { deep: false });

    @action
    addStream(stream: RTCStream) {
        this.streams.push(stream);
    }

    @action
    removeStream(stream: RTCStream) {
        this.streams.remove(stream);
    }

    @observable
    private closeData: InputRTCPeerDisconnected | undefined;

    @action
    markClosed(closeData: InputRTCPeerDisconnected) {
        this.closeData = closeData;
    }

    get closeState() {
        return this.closeData;
    }

    readonly cache = new ObservableCache();

}