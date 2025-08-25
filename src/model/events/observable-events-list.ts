import {
    action,
    observable
} from 'mobx';

import {
    CollectedEvent,
    FailedTlsConnection,
    HttpExchange,
    RTCConnection,
    RTCDataChannel,
    RTCMediaTrack,
    RawTunnel,
    TlsTunnel,
    WebSocketStream
} from '../../types';
import { TrafficSource } from '../http/sources';

/**
 * The observable events list stores the set of events, and exposes various bits of derived
 * state too, such as the list of HTTP exchanges or websockets within the events, and a map
 * of event id to event indexes.
 *
 * These are effectively computed data, but we wrap them here to avoid recomputing that data
 * from scratch every time, and to instead efficiently update it instead.
 *
 * Notable assumptions:
 * - The type of an event (the HTKEventBase isX() methods) never changes
 * - The source of an exchange never changes
 * - The event id never changes
 * - All mutative methods will be called only within MobX actions
 */
export class ObservableEventsList {

    // The internal authoritative list of events
    private readonly _events = observable.array<CollectedEvent>([], { deep: false });
    get events(): ReadonlyArray<CollectedEvent> { return this._events; }

    // --- Derived data: ---

    // A map of event ids to events:
    private readonly _eventIdIndex = observable.map<string, CollectedEvent>({}, { deep: false });

    // Arrays representing the events filtered by type:
    private readonly _exchanges = observable.array<HttpExchange>([], { deep: false });
    private readonly _websockets = observable.array<WebSocketStream>([], { deep: false });
    private readonly _tlsFailures = observable.array<FailedTlsConnection>([], { deep: false });
    private readonly _rtcConnections = observable.array<RTCConnection>([], { deep: false });
    private readonly _rtcDataChannels = observable.array<RTCDataChannel>([], { deep: false });
    private readonly _rtcMediaTracks = observable.array<RTCMediaTrack>([], { deep: false });

    get exchanges(): ReadonlyArray<HttpExchange> { return this._exchanges; }
    get websockets(): ReadonlyArray<WebSocketStream> { return this._websockets; }
    get tlsFailures(): ReadonlyArray<FailedTlsConnection> { return this._tlsFailures; }
    get rtcConnections(): ReadonlyArray<RTCConnection> { return this._rtcConnections; }
    get rtcDataChannels(): ReadonlyArray<RTCDataChannel> { return this._rtcDataChannels; }
    get rtcMediaTracks(): ReadonlyArray<RTCMediaTrack> { return this._rtcMediaTracks; }

    // The set of HTTP exchange sources (ext.request.source, unique by source.summary)
    private readonly _activeSources = observable.array<TrafficSource>([]);
    get activeSources(): ReadonlyArray<TrafficSource> { return this._activeSources; }

    push(...newEvents: CollectedEvent[]) {
        this._events.push(...newEvents);

        newEvents.forEach((event) => {
            this._eventIdIndex.set(event.id, event);

            if (event.isHttp()) {
                this._exchanges.push(event);

                const source = event.request.source;
                if (!this._activeSources.some(s => s.summary === source.summary)) {
                    this._activeSources.push(source);
                }
            }
            if (event.isWebSocket()) this._websockets.push(event);
            if (event.isTlsFailure()) this._tlsFailures.push(event);
            if (event.isRTCConnection()) this._rtcConnections.push(event);
            if (event.isRTCDataChannel()) this._rtcDataChannels.push(event);
            if (event.isRTCMediaTrack()) this._rtcMediaTracks.push(event);
        });
    }

    remove(event: CollectedEvent) {
        this._events.remove(event);
        this._eventIdIndex.delete(event.id);

        if (event.isHttp()) {
            this._exchanges.remove(event);

            // If no other exchange has this source, remove it from active sources:
            const source = event.request.source;
            if (!this._exchanges.some(e => e.request.source.summary === source.summary)) {
                this._activeSources.remove(source);
            }
        }
        if (event.isWebSocket()) this._websockets.remove(event);
        if (event.isTlsFailure()) this._tlsFailures.remove(event);
        if (event.isRTCConnection()) this._rtcConnections.remove(event);
        if (event.isRTCDataChannel()) this._rtcDataChannels.remove(event);
        if (event.isRTCMediaTrack()) this._rtcMediaTracks.remove(event);
    }

    getById<T extends CollectedEvent>(id: string, test?: (event: CollectedEvent) => event is T): T | undefined {
        const event = this._eventIdIndex.get(id);
        if (!test || !event || test(event)) return event as T | undefined;
    }

    getExchangeById = (id: string) => this.getById(id, (event): event is HttpExchange => event.isHttp());
    getWebSocketById = (id: string) => this.getById(id, (event): event is WebSocketStream => event.isWebSocket());
    getTlsTunnelById = (id: string) => this.getById(id, (event): event is TlsTunnel => event.isTlsTunnel());
    getRawTunnelById = (id: string) => this.getById(id, (event): event is RawTunnel => event.isRawTunnel());
    getRTCConnectionById = (id: string) => this.getById(id, (event): event is RTCConnection => event.isRTCConnection());

    clear() {
        this._events.clear();
        this._eventIdIndex.clear();

        this._exchanges.clear();
        this._websockets.clear();
        this._tlsFailures.clear();
        this._rtcConnections.clear();
        this._rtcDataChannels.clear();
        this._rtcMediaTracks.clear();

        this._activeSources.clear();
    }

}