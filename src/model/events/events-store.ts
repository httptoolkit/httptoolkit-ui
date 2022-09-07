import * as _ from 'lodash';
import {
    observable,
    action,
    computed,
} from 'mobx';
import { HarParseError } from 'har-validator';

import {
    InputResponse,
    InputTLSRequest,
    InputInitiatedRequest,
    InputCompletedRequest,
    InputClientError,
    CollectedEvent,
    InputWebSocketMessage,
    InputWebSocketClose,
    InputRTCEvent,
    InputRTCEventData,
    InputRTCPeerConnected,
    InputRTCDataChannelOpened,
    InputRTCMessage,
    InputRTCDataChannelClosed,
    InputRTCPeerDisconnected,
    InputRTCMediaTrackOpened,
    InputRTCMediaStats,
    InputRTCMediaTrackClosed,
    InputRTCExternalPeerAttached
} from '../../types';

import { lazyObservablePromise } from '../../util/observable';
import { reportError } from '../../errors';

import { ProxyStore } from "../proxy-store";
import { ApiStore } from '../api/api-store';

import { parseSource } from '../http/sources';
import { parseHar } from '../http/har';

import { FailedTLSConnection } from './failed-tls-connection';
import { HttpExchange } from '../http/exchange';
import { WebSocketStream } from '../websockets/websocket-stream';
import { RTCConnection } from '../webrtc/rtc-connection';
import { RTCDataChannel } from '../webrtc/rtc-data-channel';
import { RTCMediaTrack } from '../webrtc/rtc-media-track';

// Would be nice to magically infer this from the overloaded on() type, but sadly:
// https://github.com/Microsoft/TypeScript/issues/24275#issuecomment-390701982
type EventTypesMap = {
    // HTTP:
    'request-initiated': InputInitiatedRequest
    'request': InputCompletedRequest
    'response': InputResponse
    // WebSockets:
    'websocket-request': InputCompletedRequest,
    'websocket-accepted': InputResponse,
    'websocket-message-received': InputWebSocketMessage,
    'websocket-message-sent': InputWebSocketMessage,
    'websocket-close': InputWebSocketClose,
    // Mockttp misc:
    'abort': InputInitiatedRequest
    'tls-client-error': InputTLSRequest,
    'client-error': InputClientError,
} & {
    // MockRTC:
    [K in InputRTCEvent]: InputRTCEventData[K];
}

const mockttpEventTypes = [
    'request-initiated',
    'request',
    'response',
    'websocket-request',
    'websocket-accepted',
    'websocket-message-received',
    'websocket-message-sent',
    'websocket-close',
    'abort',
    'tls-client-error',
    'client-error'
] as const;

const mockRTCEventTypes = [
    'peer-connected',
    'peer-disconnected',
    'external-peer-attached',
    'data-channel-opened',
    'data-channel-message-sent',
    'data-channel-message-received',
    'data-channel-closed',
    'media-track-opened',
    'media-track-stats',
    'media-track-closed'
] as const;

type MockttpEventType = typeof mockttpEventTypes[number];
type MockRTCEventType = typeof mockRTCEventTypes[number]

type EventType =
    | MockttpEventType
    | MockRTCEventType;

type QueuedEvent = ({
    [T in EventType]: { type: T, event: EventTypesMap[T] }
}[EventType]);

type OrphanableQueuedEvent<T extends
    | 'response'
    | 'abort'
    | 'websocket-accepted'
    | 'websocket-message-received'
    | 'websocket-message-sent'
    | 'websocket-close'
    | 'peer-disconnected'
    | 'external-peer-attached'
    | 'data-channel-opened'
    | 'data-channel-message-sent'
    | 'data-channel-message-received'
    | 'data-channel-closed'
    | 'media-track-opened'
    | 'media-track-stats'
    | 'media-track-closed'
> = { type: T, event: EventTypesMap[T] };

export class EventsStore {

    constructor(
        private proxyStore: ProxyStore,
        private apiStore: ApiStore
    ) { }

    readonly initialized = lazyObservablePromise(async () => {
        await Promise.all([
            this.proxyStore.initialized,
            this.apiStore.initialized
        ]);

        mockttpEventTypes.forEach(<T extends MockttpEventType>(eventName: T) => {
            this.proxyStore.onMockttpEvent(eventName, ((eventData: EventTypesMap[T]) => {
                if (this.isPaused) return;
                this.eventQueue.push({ type: eventName, event: eventData } as any);
                this.queueEventFlush();
            }));
        });

        mockRTCEventTypes.forEach(<T extends MockRTCEventType>(eventName: T) => {
            this.proxyStore.onMockRTCEvent(eventName, ((eventData: EventTypesMap[T]) => {
                if (this.isPaused) return;
                this.eventQueue.push({ type: eventName, event: eventData } as any);
                this.queueEventFlush();
            }));
        });

        console.log('Events store initialized');
    });

    @observable
    isPaused = false;

    private eventQueue: Array<QueuedEvent> = [];
    private orphanedEvents: { [id: string]: OrphanableQueuedEvent<any> } = {};

    private isFlushQueued = false;
    private queueEventFlush() {
        if (!this.isFlushQueued) {
            this.isFlushQueued = true;
            requestAnimationFrame(this.flushQueuedUpdates);
        }
    }

    readonly events = observable.array<CollectedEvent>([], { deep: false });

    @computed.struct
    get exchanges(): Array<HttpExchange> {
        return this.events.filter((e): e is HttpExchange => e.isHttp());
    }

    @computed.struct
    get websockets(): Array<WebSocketStream> {
        return this.exchanges.filter((e): e is WebSocketStream => e.isWebSocket());
    }

    @computed.struct
    get rtcConnections(): Array<RTCConnection> {
        return this.events.filter((e): e is RTCConnection => e.isRTCConnection());
    }

    @computed.struct
    get rtcDataChannels(): Array<RTCDataChannel> {
        return this.events.filter((e): e is RTCDataChannel => e.isRTCDataChannel());
    }

    @computed.struct
    get rtcMediaTracks(): Array<RTCMediaTrack> {
        return this.events.filter((e): e is RTCMediaTrack => e.isRTCMediaTrack());
    }

    @computed.struct
    get activeSources() {
        return _(this.exchanges)
            .map(e => e.request.headers['user-agent'])
            .uniq()
            .map(parseSource)
            .uniqBy(s => s.summary)
            .value();
    }

    @action.bound
    private flushQueuedUpdates() {
        this.isFlushQueued = false;

        // We batch request updates until here. This runs in a mobx transaction and
        // on request animation frame, so batches get larger and cheaper if
        // the frame rate starts to drop.

        this.eventQueue.forEach(this.updateFromQueuedEvent);
        this.eventQueue = [];
    }

    private updateFromQueuedEvent = (queuedEvent: QueuedEvent) => {
        try {
            switch (queuedEvent.type) {
                case 'request-initiated':
                    this.addInitiatedRequest(queuedEvent.event);
                    return this.checkForOrphan(queuedEvent.event.id);
                case 'request':
                    this.addCompletedRequest(queuedEvent.event);
                    return this.checkForOrphan(queuedEvent.event.id);
                case 'response':
                    return this.setResponse(queuedEvent.event);
                case 'websocket-request':
                    this.addWebSocketRequest(queuedEvent.event);
                    return this.checkForOrphan(queuedEvent.event.id);
                case 'websocket-accepted':
                    return this.addAcceptedWebSocketResponse(queuedEvent.event);
                case 'websocket-message-received':
                case 'websocket-message-sent':
                    return this.addWebSocketMessage(queuedEvent.event);
                case 'websocket-close':
                    return this.markWebSocketClosed(queuedEvent.event);
                case 'abort':
                    return this.markRequestAborted(queuedEvent.event);
                case 'tls-client-error':
                    return this.addFailedTlsRequest(queuedEvent.event);
                case 'client-error':
                    return this.addClientError(queuedEvent.event);

                case 'peer-connected':
                    return this.addRTCPeerConnection(queuedEvent.event);
                case 'external-peer-attached':
                    return this.attachExternalRTCPeer(queuedEvent.event);
                case 'peer-disconnected':
                    return this.markRTCPeerDisconnected(queuedEvent.event);
                case 'data-channel-opened':
                    return this.addRTCDataChannel(queuedEvent.event);
                case 'data-channel-message-sent':
                case 'data-channel-message-received':
                    return this.addRTCDataChannelMessage(queuedEvent.event);
                case 'data-channel-closed':
                    return this.markRTCDataChannelClosed(queuedEvent.event);
                case 'media-track-opened':
                    return this.addRTCMediaTrack(queuedEvent.event);
                case 'media-track-stats':
                    return this.addRTCMediaTrackStats(queuedEvent.event);
                case 'media-track-closed':
                    return this.markRTCMediaTrackClosed(queuedEvent.event);
            }
        } catch (e) {
            // It's possible we might fail to parse an input event. This shouldn't happen, but if it
            // does it's better to drop that one event and continue instead of breaking completely.
            reportError(e);
        }
    }

    private checkForOrphan(id: string) {
        // Sometimes we receive events out of order (response/abort before request).
        // They could be later in the same batch, or in a previous batch. If that happens,
        // we store them separately, and we check later whether they're valid when subsequent
        // completed/initiated request events come in. If so, we re-queue them.

        const orphanEvent = this.orphanedEvents[id];

        if (orphanEvent) {
            delete this.orphanedEvents[id];
            this.updateFromQueuedEvent(orphanEvent);
        }
    }

    @action.bound
    togglePause() {
        this.isPaused = !this.isPaused;
    }

    @action
    private addInitiatedRequest(request: InputInitiatedRequest) {
        // Due to race conditions, it's possible this request already exists. If so,
        // we just skip this - the existing data will be more up to date.
        const existingEventIndex = _.findIndex(this.events, { id: request.id });
        if (existingEventIndex === -1) {
            const exchange = new HttpExchange(this.apiStore, request);
            this.events.push(exchange);
        }
    }

    @action
    private addCompletedRequest(request: InputCompletedRequest) {
        // The request should already exist: we get an event when the initial path & headers
        // are received, and this one later when the full body is received.
        // We add the request from scratch if it's somehow missing, which can happen given
        // races or if the server doesn't support request-initiated events.
        const existingEventIndex = _.findIndex(this.events, { id: request.id });
        if (existingEventIndex >= 0) {
            (this.events[existingEventIndex] as HttpExchange).updateFromCompletedRequest(request);
        } else {
            this.events.push(new HttpExchange(this.apiStore, request));
        }
    }

    @action
    private markRequestAborted(request: InputInitiatedRequest) {
        const exchange = _.find(this.exchanges, { id: request.id });

        if (!exchange) {
            // Handle this later, once the request has arrived
            this.orphanedEvents[request.id] = { type: 'abort', event: request };
            return;
        };

        exchange.markAborted(request);
    }

    @action
    private setResponse(response: InputResponse) {
        const exchange = _.find(this.exchanges, { id: response.id });

        if (!exchange) {
            // Handle this later, once the request has arrived
            this.orphanedEvents[response.id] = { type: 'response', event: response };
            return;
        }

        exchange.setResponse(response);
    }

    @action
    private addWebSocketRequest(request: InputCompletedRequest) {
        this.events.push(new WebSocketStream(this.apiStore, request));
    }

    @action
    private addAcceptedWebSocketResponse(response: InputResponse) {
        const stream = _.find(this.websockets, { id: response.id });

        if (!stream) {
            // Handle this later, once the request has arrived
            this.orphanedEvents[response.id] = { type: 'websocket-accepted', event: response };
            return;
        }

        stream.setResponse(response);
        stream.setAccepted(response);
    }

    @action
    private addWebSocketMessage(message: InputWebSocketMessage) {
        const stream = _.find(this.websockets, { id: message.streamId });

        if (!stream) {
            // Handle this later, once the request has arrived
            this.orphanedEvents[message.streamId] = {
                type: `websocket-message-${message.direction}`,
                event: message
            };
            return;
        }

        stream.addMessage(message);
    }

    @action
    private markWebSocketClosed(close: InputWebSocketClose) {
        const stream = _.find(this.websockets, { id: close.streamId });

        if (!stream) {
            // Handle this later, once the request has arrived
            this.orphanedEvents[close.streamId] = { type: 'websocket-close', event: close };
            return;
        }

        stream.markClosed(close);
    }

    @action
    private addFailedTlsRequest(request: InputTLSRequest) {
        if (_.some(this.events, (event) =>
            'hostname' in event &&
            event.hostname === request.hostname &&
            event.remoteIpAddress === request.remoteIpAddress
        )) return; // Drop duplicate TLS failures

        this.events.push(new FailedTLSConnection(request));
    }

    @action
    private addClientError(error: InputClientError) {
        if (error.errorCode === 'ECONNRESET' && !error.request.method && !error.request.url) {
            // We don't bother showing client resets before any data was sent at all.
            // Not interesting, nothing to show, and generally all a bit noisey.
            return;
        }

        if (error.errorCode === 'ERR_SSL_DECRYPTION_FAILED_OR_BAD_RECORD_MAC') {
            // The TLS connection was interrupted by a bad packet. Generally paired with
            // an abort event for ongoing requests, so no need for a separate error.
            return;
        }

        const exchange = new HttpExchange(this.apiStore, {
            ...error.request,
            protocol: error.request.protocol || '',
            method: error.request.method || '',
            url: error.request.url || `${error.request.protocol || 'http'}://`,
            path: error.request.path || '/',
            headers: error.request.headers
        });

        if (error.response === 'aborted') {
            exchange.markAborted(error.request);
        } else {
            exchange.setResponse(error.response);
        }

        this.events.push(exchange);
    }

    @action
    private addRTCPeerConnection(event: InputRTCPeerConnected) {
        this.events.push(new RTCConnection(event));
    }

    @action
    private attachExternalRTCPeer(event: InputRTCExternalPeerAttached) {
        const conn = this.rtcConnections.find(c => c.id === event.sessionId);
        const otherHalf = this.rtcConnections.find(c => c.isOtherHalfOf(event));

        if (conn) {
            conn.attachExternalPeer(event, otherHalf);
            if (otherHalf) otherHalf.connectOtherHalf(conn);
        } else {
            this.orphanedEvents[event.sessionId] = { type: 'external-peer-attached', event };
        }
    }

    @action
    private markRTCPeerDisconnected(event: InputRTCPeerDisconnected) {
        const conn = this.rtcConnections.find(c => c.id === event.sessionId);
        if (conn) {
            conn.markClosed(event);
        } else {
            this.orphanedEvents[event.sessionId] = { type: 'peer-disconnected', event };
        }
    }

    @action
    private addRTCDataChannel(event: InputRTCDataChannelOpened) {
        const conn = this.rtcConnections.find(c => c.id === event.sessionId);
        if (conn) {
            const dc = new RTCDataChannel(event, conn);
            this.events.push(dc);
            conn.addStream(dc);
        } else {
            this.orphanedEvents[event.sessionId] = { type: 'data-channel-opened', event };
        }
    }

    @action
    private addRTCDataChannelMessage(event: InputRTCMessage) {
        const channel = this.rtcDataChannels.find(c => c.sessionId === event.sessionId && c.channelId === event.channelId);
        if (channel) {
            channel.addMessage(event);
        } else {
            this.orphanedEvents[event.sessionId] = { type: `data-channel-message-${event.direction}`, event };
        }
    }

    @action
    private markRTCDataChannelClosed(event: InputRTCDataChannelClosed) {
        const channel = this.rtcDataChannels.find(c => c.sessionId === event.sessionId && c.channelId === event.channelId);
        if (channel) {
            channel.markClosed(event);
        } else {
            this.orphanedEvents[event.sessionId] = { type: 'data-channel-closed', event };
        }
    }

    @action
    private addRTCMediaTrack(event: InputRTCMediaTrackOpened) {
        const conn = this.rtcConnections.find(c => c.id === event.sessionId);
        if (conn) {
            const track = new RTCMediaTrack(event, conn);
            this.events.push(track);
            conn.addStream(track);
        } else {
            this.orphanedEvents[event.sessionId] = { type: 'media-track-opened', event };
        }
    }

    @action
    private addRTCMediaTrackStats(event: InputRTCMediaStats) {
        const track = this.rtcMediaTracks.find(t => t.sessionId === event.sessionId && t.mid === event.trackMid);
        if (track) {
            track.addStats(event);
        } else {
            this.orphanedEvents[event.sessionId] = { type: 'media-track-stats', event };
        }
    }

    @action
    private markRTCMediaTrackClosed(event: InputRTCMediaTrackClosed) {
        const track = this.rtcMediaTracks.find(t => t.sessionId === event.sessionId && t.mid === event.trackMid);
        if (track) {
            track.markClosed(event);
        } else {
            this.orphanedEvents[event.sessionId] = { type: 'media-track-closed', event };
        }
    }

    @action.bound
    deleteEvent(event: CollectedEvent) {
        this.events.remove(event);

        if (event.isRTCDataChannel() || event.isRTCMediaTrack()) {
            event.rtcConnection.removeStream(event);
        } else if (event.isRTCConnection()) {
            const streams = [...event.streams];
            streams.forEach((stream) => this.deleteEvent(stream));
        }

        if ('cleanup' in event) event.cleanup();
    }

    @action.bound
    clearInterceptedData(clearPinned: boolean) {
        const [pinnedEvents, unpinnedEvents] = _.partition(
            this.events,
            clearPinned ? () => false : (ex) => ex.pinned
        );

        this.events.clear();
        unpinnedEvents.forEach((event) => { if ('cleanup' in event) event.cleanup() });

        this.events.push(...pinnedEvents);
        this.orphanedEvents = {};

        // If GC is exposed (desktop 0.1.22+), trigger it when data is cleared,
        // as this is the perfect point to pack everything down.
        if ('gc' in window) (window as any).gc();
    }

    async loadFromHar(harContents: {}) {
        const {
            requests,
            responses,
            aborts,
            tlsErrors,
            pinnedIds
        } = await parseHar(harContents).catch((harParseError: HarParseError) => {
            // Log all suberrors, for easier reporting & debugging.
            // This does not include HAR data - only schema errors like
            // 'bodySize is missing' at 'entries[1].request'
            harParseError.errors.forEach((error) => {
                console.log(error);
            });
            throw harParseError;
        });

        // We now take each of these input items, and put them on the queue to be added
        // to the UI like any other seen request data. Arguably we could call addRequest &
        // setResponse etc directly, but this is nicer if the UI thread is already under strain.

        // First, we put the request & TLS error events together in order:
        this.eventQueue.push(..._.sortBy([
            ...requests.map(r => ({ type: 'request' as const, event: r })),
            ...tlsErrors.map(r => ({ type: 'tls-client-error' as const, event: r }))
        ], e => e.event.timingEvents.startTime));

        // Then we add responses & aborts. They just update requests, so order doesn't matter:
        this.eventQueue.push(
            ...responses.map(r => ({ type: 'response' as const, event: r })),
            ...aborts.map(r => ({ type: 'abort' as const, event: r }))
        );

        this.queueEventFlush();

        if (pinnedIds.length) {
            // This rAF will be scheduled after the queued flush, so the event should
            // always be fully imported by this stage:
            requestAnimationFrame(action(() => pinnedIds.forEach((id) => {
                this.events.find(e => e.id === id)!.pinned = true;
            })));
        }
    }

}