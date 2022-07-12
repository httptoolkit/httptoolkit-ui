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

    isRTCConnection() {
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

    private attachedConnection:
        | {
            externalConnection: {
                sessionId: string,
                localSessionDescription: RTCSessionDescriptionInit,
                remoteSessionDescription: RTCSessionDescriptionInit
            },
            otherHalf?: RTCConnection
        }
        | undefined;

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

        const ourLocalSdp = ourExternalConnection.localSessionDescription.sdp;
        const theirLocalSdp = theirExternalConnection.localSessionDescription.sdp;
        const ourRemoteSdp = ourExternalConnection.remoteSessionDescription.sdp;
        const theirRemoteSdp = theirExternalConnection.remoteSessionDescription.sdp;

        return ourLocalSdp === theirRemoteSdp && ourRemoteSdp === theirLocalSdp;
    }

    connectOtherHalf(otherHalf: RTCConnection) {
        this.attachedConnection!.otherHalf = otherHalf;
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