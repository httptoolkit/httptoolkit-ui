import { action, observable } from "mobx";
import {
    InputRTCPeerConnected,
    InputRTCExternalPeerAttached,
    InputRTCPeerDisconnected
} from "../../types";
import { HTKEventBase } from "../events/event-base";

export class RTCConnection extends HTKEventBase {

    constructor(
        private connectionEvent: InputRTCPeerConnected
    ) {
        super();
    }

    readonly id = this.connectionEvent.sessionId;

    get peerId() {
        return this.connectionEvent.peerId;
    }

    get localSessionDescription() {
        return this.connectionEvent.localSessionDescription;
    }

    get remoteSessionDescription() {
        return this.connectionEvent.remoteSessionDescription;
    }

    private externalPeer: InputRTCExternalPeerAttached | undefined;

    attachExternalPeer(externalPeer: InputRTCExternalPeerAttached) {
        this.externalPeer = externalPeer;
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

}