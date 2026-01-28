import * as _ from 'lodash';
import {
    observable,
    action
} from 'mobx';
import { HarParseError } from 'har-validator';

import {
    InputResponse,
    InputTlsFailure,
    InputTlsPassthrough,
    InputInitiatedRequest,
    InputCompletedRequest,
    InputFailedRequest,
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
    InputRTCExternalPeerAttached,
    InputRuleEvent,
    InputRawPassthrough,
    InputRawPassthroughData,
    InputRequest
} from '../../types';

import { lazyObservablePromise } from '../../util/observable';
import { logError } from '../../errors';

import { ProxyStore } from "../proxy-store";
import { ApiStore } from '../api/api-store';
import { RulesStore } from '../rules/rules-store';
import { findItem, isRuleGroup } from '../rules/rules-structure';

import { ObservableEventsList } from './observable-events-list';

import { parseHar } from '../http/har';

import { FailedTlsConnection } from '../tls/failed-tls-connection';
import { TlsTunnel } from '../tls/tls-tunnel';
import { RawTunnel } from '../raw-tunnel';
import { HttpExchange } from '../http/http-exchange';
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
    'abort': InputInitiatedRequest,
    'tls-client-error': InputTlsFailure,
    'tls-passthrough-opened': InputTlsPassthrough,
    'tls-passthrough-closed': InputTlsPassthrough,
    'client-error': InputClientError,
    'raw-passthrough-opened': InputRawPassthrough,
    'raw-passthrough-closed': InputRawPassthrough,
    'raw-passthrough-data': InputRawPassthroughData,
    'rule-event': InputRuleEvent
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
    'tls-passthrough-opened',
    'tls-passthrough-closed',
    'client-error',
    'raw-passthrough-opened',
    'raw-passthrough-closed',
    'raw-passthrough-data',
    'rule-event'
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

export type QueuedEvent =
    | ({ // Received Mockttp event data:
        [T in EventType]: { type: T, event: EventTypesMap[T] }
    }[EventType])
    | { type: 'queued-callback', cb: () => void } // Or a callback to run after data is processed

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
    | 'tls-passthrough-closed'
    | 'raw-passthrough-closed'
    | 'raw-passthrough-data'
> = { type: T, event: EventTypesMap[T] };

const LARGE_QUEUE_BATCH_SIZE = 1033; // Off by 33 for a new ticking UI effect

export class EventsStore {

    constructor(
        private proxyStore: ProxyStore,
        private apiStore: ApiStore,
        private rulesStore: RulesStore
    ) { }

    readonly initialized = lazyObservablePromise(async () => {
        await Promise.all([
            this.proxyStore.initialized,
            this.apiStore.initialized,
            this.rulesStore.initialized
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

    readonly eventsList = new ObservableEventsList();

    get events() { return this.eventsList.events; }
    get exchanges() { return this.eventsList.exchanges; }
    get websockets() { return this.eventsList.websockets; }
    get tlsFailures() { return this.eventsList.tlsFailures; }
    get rtcConnections() { return this.eventsList.rtcConnections; }
    get rtcDataChannels() { return this.eventsList.rtcDataChannels; }
    get rtcMediaTracks() { return this.eventsList.rtcMediaTracks; }
    get activeSources() { return this.eventsList.activeSources; }

    @action.bound
    private flushQueuedUpdates() {
        this.isFlushQueued = false;

        // We batch request updates until here. This runs in a mobx transaction and
        // on request animation frame, so batches get larger and cheaper if
        // the frame rate starts to drop.

        if (this.eventQueue.length > LARGE_QUEUE_BATCH_SIZE) {
            // If there's a lot of events in the queue (only ever likely to happen
            // in an import of a large file) we break it up to keep the UI responsive.
            this.eventQueue.slice(0, LARGE_QUEUE_BATCH_SIZE).forEach(this.updateFromQueuedEvent);
            this.eventQueue = this.eventQueue.slice(LARGE_QUEUE_BATCH_SIZE);
            setTimeout(() => {
                this.queueEventFlush();
            }, 10);
        } else {
            this.eventQueue.forEach(this.updateFromQueuedEvent);
            this.eventQueue = [];
        }
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
                case 'tls-passthrough-opened':
                    this.addTlsTunnel(queuedEvent.event);
                    return this.checkForOrphan(queuedEvent.event.id);
                case 'tls-passthrough-closed':
                    return this.markTlsTunnelClosed(queuedEvent.event);
                case 'tls-client-error':
                    return this.addFailedTlsRequest(queuedEvent.event);
                case 'client-error':
                    return this.addClientError(queuedEvent.event);

                case 'raw-passthrough-opened':
                    return this.addRawTunnel(queuedEvent.event);
                case 'raw-passthrough-closed':
                    return this.markRawTunnelClosed(queuedEvent.event);
                case 'raw-passthrough-data':
                    return this.addRawTunnelChunk(queuedEvent.event);

                case 'rule-event':
                    return this.addRuleEvent(queuedEvent.event);

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

                case 'queued-callback':
                    queuedEvent.cb();
                    return;
            }
        } catch (e) {
            // It's possible we might fail to parse an input event. This shouldn't happen, but if it
            // does it's better to drop that one event and continue instead of breaking completely.
            logError(e);
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
        const existingEvent = this.eventsList.getById(request.id);
        if (existingEvent) return;

        const exchange = new HttpExchange(request, this.apiStore);
        this.eventsList.push(exchange);
    }

    private getMatchedRule(request: InputCompletedRequest) {
        if (!request.matchedRuleId) return false;

        const matchedItem = findItem(this.rulesStore.rules, { id: request.matchedRuleId });

        // This shouldn't really happen, but could in race conditions with rule editing:
        if (!matchedItem) return false;

        // This should never happen, but it's good to check:
        if (isRuleGroup(matchedItem)) throw new Error('Request event unexpectedly matched rule group');

        return matchedItem;
    }

    @action
    private addCompletedRequest(request: InputCompletedRequest) {
        // The request should already exist: we get an event when the initial path & headers
        // are received, and this one later when the full body is received.
        // We add the request from scratch if it's somehow missing, which can happen given
        // races or if the server doesn't support request-initiated events.
        const existingEvent = this.eventsList.getById(request.id);

        let event: HttpExchange;
        if (existingEvent) {
            event = existingEvent as HttpExchange
        } else {
            event = new HttpExchange({ ...request }, this.apiStore);
            // ^ This mutates request to use it, so we have to shallow-clone to use it below too:
            this.eventsList.push(event);
        }

        event.updateFromCompletedRequest(request, this.getMatchedRule(request));
    }

    @action
    private markRequestAborted(request: InputFailedRequest) {
        const exchange = this.eventsList.getExchangeById(request.id);

        if (!exchange) {
            // Handle this later, once the request has arrived
            this.orphanedEvents[request.id] = { type: 'abort', event: request };
            return;
        };

        exchange.markAborted(request);
    }

    @action
    private setResponse(response: InputResponse) {
        const exchange = this.eventsList.getExchangeById(response.id);

        if (!exchange) {
            // Handle this later, once the request has arrived
            this.orphanedEvents[response.id] = { type: 'response', event: response };
            return;
        }

        exchange.setResponse(response);
    }

    @action
    private addWebSocketRequest(request: InputCompletedRequest) {
        const stream = new WebSocketStream({ ...request }, this.apiStore);
        // ^ This mutates request to use it, so we have to shallow-clone to use it below too

        stream.updateFromCompletedRequest(request, this.getMatchedRule(request));
        this.eventsList.push(stream);
    }

    @action
    private addAcceptedWebSocketResponse(response: InputResponse) {
        const stream = this.eventsList.getWebSocketById(response.id);

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
        const stream = this.eventsList.getWebSocketById(message.streamId);

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
        const stream = this.eventsList.getWebSocketById(close.streamId);

        if (!stream) {
            // Handle this later, once the request has arrived
            this.orphanedEvents[close.streamId] = {
                type: 'websocket-close', event: close
            };
            return;
        }

        stream.markClosed(close);
    }

    @action
    private addTlsTunnel(openEvent: InputTlsPassthrough) {
        this.eventsList.push(new TlsTunnel(openEvent));
    }

    @action
    private markTlsTunnelClosed(closeEvent: InputTlsPassthrough) {
        const tunnel = this.eventsList.getTlsTunnelById(closeEvent.id);

        if (!tunnel) {
            // Handle this later, once the tunnel open event has arrived
            this.orphanedEvents[closeEvent.id] = {
                type: 'tls-passthrough-closed', event: close
            };
            return;
        }

        tunnel.markClosed(closeEvent);
    }

    @action
    private addRawTunnel(openEvent: InputRawPassthrough) {
        const tunnel = new RawTunnel(openEvent);
        this.eventsList.push(tunnel);
    }

    @action
    private markRawTunnelClosed(closeEvent: InputRawPassthrough) {
        const tunnel = this.eventsList.getRawTunnelById(closeEvent.id);

        if (!tunnel) {
            // Handle this later, once the tunnel open event has arrived
            this.orphanedEvents[closeEvent.id] = {
                type: 'raw-passthrough-closed', event: closeEvent
            };
            return;
        }

        tunnel.markClosed(closeEvent);
    }

    @action
    private addRawTunnelChunk(dataEvent: InputRawPassthroughData) {
        const tunnel = this.eventsList.getRawTunnelById(dataEvent.id);

        if (!tunnel) {
            // Handle this later, once the tunnel open event has arrived
            this.orphanedEvents[dataEvent.id] = {
                type: 'raw-passthrough-data', event: dataEvent
            };
            return;
        }

        tunnel.addChunk(dataEvent);
    }

    @action
    private addFailedTlsRequest(request: InputTlsFailure) {
        if (this.tlsFailures.some((failure) =>
            failure.upstreamHostname === (
                request.tlsMetadata.sniHostname ??
                request.destination?.hostname ??
                request.hostname
            ) &&
            failure.remoteIpAddress === request.remoteIpAddress
        )) return; // Drop duplicate TLS failures

        this.eventsList.push(new FailedTlsConnection(request));
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

        const request = {
            ...error.request,
            matchedRuleId: false,
            method: error.request.method || '',
            url: error.request.url || `${error.request.protocol || 'http'}://`,
            headers: error.request.headers
        } satisfies InputRequest;

        const exchange = new HttpExchange(request, this.apiStore);

        if (error.response === 'aborted') {
            exchange.markAborted(request);
        } else {
            exchange.setResponse(error.response);
        }

        this.eventsList.push(exchange);
    }

    @action
    private addRuleEvent(event: InputRuleEvent) {
        const exchange = this.eventsList.getExchangeById(event.requestId);

        if (!exchange) {
            // Handle this later, once the request has arrived
            this.orphanedEvents[event.requestId] = { type: 'rule-event', event };
            return;
        };

        switch (event.eventType) {
            case 'passthrough-request-head':
                exchange.updateFromUpstreamRequestHead(event.eventData);
                break;
            case 'passthrough-request-body':
                exchange.updateFromUpstreamRequestBody(event.eventData);
                break;
            case 'passthrough-response-head':
                exchange.updateFromUpstreamResponseHead(event.eventData);
                break;
            case 'passthrough-response-body':
                exchange.updateFromUpstreamResponseBody(event.eventData);
                break;
            case 'passthrough-abort':
                exchange.updateFromUpstreamAbort(event.eventData);
                break;

            case 'passthrough-websocket-connect':
                if (!exchange.isWebSocket()) throw new Error('Received WS connect event for non-WS');
                const webSocket = exchange as WebSocketStream;
                webSocket.updateWithUpstreamConnect(event.eventData);
                break;
        }
    }

    @action
    private addRTCPeerConnection(event: InputRTCPeerConnected) {
        this.eventsList.push(new RTCConnection(event));
    }

    @action
    private attachExternalRTCPeer(event: InputRTCExternalPeerAttached) {
        const conn = this.eventsList.getRTCConnectionById(event.sessionId);
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
        const conn = this.eventsList.getRTCConnectionById(event.sessionId);
        if (conn) {
            conn.markClosed(event);
        } else {
            this.orphanedEvents[event.sessionId] = { type: 'peer-disconnected', event };
        }
    }

    @action
    private addRTCDataChannel(event: InputRTCDataChannelOpened) {
        const conn = this.eventsList.getRTCConnectionById(event.sessionId);
        if (conn) {
            const dc = new RTCDataChannel(event, conn);
            this.eventsList.push(dc);
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
        const conn = this.eventsList.getRTCConnectionById(event.sessionId);
        if (conn) {
            const track = new RTCMediaTrack(event, conn);
            this.eventsList.push(track);
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
        this.eventsList.remove(event);

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

        this.eventsList.clear();
        unpinnedEvents.forEach((event) => { if ('cleanup' in event) event.cleanup() });

        this.eventsList.push(...pinnedEvents);
        this.orphanedEvents = {};

        // If GC is exposed (desktop 0.1.22+), trigger it when data is cleared,
        // as this is the perfect point to pack everything down.
        if ('gc' in window) (window as any).gc();
    }

    async loadFromHar(harContents: {}) {
        const { events, pinnedIds } = await parseHar(harContents).catch((harParseError: HarParseError) => {
            // Log all suberrors, for easier reporting & debugging.
            // This does not include HAR data - only schema errors like
            // 'bodySize is missing' at 'entries[1].request'
            if (harParseError.errors) {
                harParseError.errors.forEach((error) => {
                    console.log(error);
                });
            } else {
                console.log(harParseError);
            }
            throw harParseError;
        });

        // We now take each of these input items, and put them on the queue to be added
        // to the UI like any other seen request data. Arguably we could call addRequest &
        // setResponse etc directly, but this is nicer in case the UI thread is already under strain.
        this.eventQueue.push(...events);

        // After all events are handled, set the required pins:
        this.eventQueue.push({
            type: 'queued-callback',
            cb: action(() => pinnedIds.forEach((id) => {
                this.events.find(e => e.id === id)!.pinned = true;
            }))
        });

        this.queueEventFlush();
    }

    @action
    recordSentRequest(request: InputCompletedRequest): HttpExchange {
        const exchange = new HttpExchange({ ...request }, this.apiStore);
        // ^ This mutates request to use it, so we have to shallow-clone to use it below too:
        exchange.updateFromCompletedRequest(request, false);

        this.eventsList.push(exchange);
        return exchange;
    }

}