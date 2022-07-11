import * as _ from 'lodash';
import {
    observable,
    action,
    computed,
} from 'mobx';
import * as uuid from 'uuid/v4';
import { HarParseError } from 'har-validator';

import {
    InputResponse,
    InputTlsRequest,
    InputInitiatedRequest,
    InputCompletedRequest,
    InputClientError,
    CollectedEvent,
    InputWebSocketMessage,
    InputWebSocketClose
} from '../../types';
import { HttpExchange } from '../http/exchange';
import { parseSource } from '../http/sources';

import { ProxyStore } from "../proxy-store";
import { ApiStore } from '../api/api-store';
import { lazyObservablePromise } from '../../util/observable';
import { reportError } from '../../errors';
import { parseHar } from '../http/har';
import { WebSocketStream } from '../websockets/websocket-stream';

// Would be nice to magically infer this from the overloaded on() type, but sadly:
// https://github.com/Microsoft/TypeScript/issues/24275#issuecomment-390701982
type EventTypesMap = {
    'request-initiated': InputInitiatedRequest
    'request': InputCompletedRequest
    'response': InputResponse
    'websocket-request': InputCompletedRequest,
    'websocket-accepted': InputResponse,
    'websocket-message-received': InputWebSocketMessage,
    'websocket-message-sent': InputWebSocketMessage,
    'websocket-close': InputWebSocketClose,
    'abort': InputInitiatedRequest
    'tls-client-error': InputTlsRequest,
    'client-error': InputClientError
};

const eventTypes = [
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

type EventType = typeof eventTypes[number];

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

        const { onServerEvent } = this.proxyStore;

        eventTypes.forEach(<T extends EventType>(eventName: T) => {
            // Lots of 'any' because TS can't handle overload + type interception
            onServerEvent(eventName as any, ((eventData: EventTypesMap[T]) => {
                if (this.isPaused) return;
                this.eventQueue.push({ type: eventName, event: eventData } as any);
                this.queueEventFlush();
            }) as any);
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

    @computed
    get exchanges(): Array<HttpExchange> {
        return this.events.filter(
            (event: any): event is HttpExchange => !!event.request
        );
    }

    @computed
    get websockets(): Array<WebSocketStream> {
        return this.exchanges.filter(
            (event): event is WebSocketStream => event.isWebSocket()
        );
    }

    @computed get activeSources() {
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
            }
        } catch (e) {
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
    private addFailedTlsRequest(request: InputTlsRequest) {
        if (_.some(this.events, (event) =>
            'hostname' in event &&
            event.hostname === request.hostname &&
            event.remoteIpAddress === request.remoteIpAddress
        )) return; // Drop duplicate TLS failures

        this.events.push(Object.assign(request, {
            id: uuid(),
            pinned: false,
            searchIndex: [request.hostname, request.remoteIpAddress]
                .filter((x): x is string => !!x)
                .join('\n')
        }));
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

    @action.bound
    deleteEvent(event: CollectedEvent) {
        this.events.remove(event);
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
            tlsErrors
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
    }

}