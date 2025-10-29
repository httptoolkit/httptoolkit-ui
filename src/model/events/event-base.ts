import { observable, computed } from 'mobx';

import {
    FailedTlsConnection,
    TlsTunnel,
    HttpExchangeView,
    WebSocketView,
    RTCConnection,
    RTCDataChannel,
    RTCMediaTrack,
    RawTunnel
} from '../../types';

import { getEventCategory } from './categorization';

export abstract class HTKEventBase {

    abstract get id(): string;

    // These can be overriden by subclasses to allow easy type narrowing:
    isHttp(): this is HttpExchangeView { return false; }
    isWebSocket(): this is WebSocketView { return false; }

    isTlsFailure(): this is FailedTlsConnection { return false; }
    isTlsTunnel(): this is TlsTunnel { return false; }
    isRawTunnel(): this is RawTunnel { return false; }

    isTunnel(): this is TlsTunnel | RawTunnel {
        return this.isTlsTunnel() || this.isRawTunnel();
    }

    isRTCConnection(): this is RTCConnection { return false; }
    isRTCDataChannel(): this is RTCDataChannel { return false; }
    isRTCMediaTrack(): this is RTCMediaTrack { return false; }

    isRTC(): this is RTCConnection | RTCDataChannel | RTCMediaTrack {
        return this.isRTCConnection() || this.isRTCDataChannel() || this.isRTCMediaTrack();
    }

    @computed
    public get category() {
        return getEventCategory(this);
    }

    @observable
    private _searchIndex: string = '';
    public get searchIndex(): string { return this._searchIndex; }
    public set searchIndex(value: string) { this._searchIndex = value; }

    @observable
    private _pinned: boolean = false;
    public get pinned(): boolean { return this._pinned; }
    public set pinned(value: boolean) { this._pinned = value; }

}