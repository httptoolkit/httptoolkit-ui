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
    FailedTlsRequest,
    InputTlsRequest,
    InputInitiatedRequest,
    InputCompletedRequest,
} from '../../types';
import { HttpExchange } from './exchange';
import { parseSource } from './sources';

import { ServerStore } from "../server-store";
import { ApiStore } from '../api/api-store';
import { lazyObservablePromise } from '../../util/observable';
import { reportError } from '../../errors';
import { parseHar } from './har';

// Would be nice to magically infer this from the overloaded on() type, but sadly:
// https://github.com/Microsoft/TypeScript/issues/24275#issuecomment-390701982
type EventTypesMap = {
    'request-initiated': InputInitiatedRequest
    'request': InputCompletedRequest
    'response': InputResponse
    'abort': InputInitiatedRequest
    'tlsClientError': InputTlsRequest
};

const eventTypes = [
    'request-initiated',
    'request',
    'response',
    'abort',
    'tlsClientError'
] as const;

type EventType = typeof eventTypes[number];

type QueuedEvent = ({
    [T in EventType]: { type: T, event: EventTypesMap[T] }
}[EventType]);

type OrphanableQueuedEvent =
    | { type: 'response', event: InputResponse }
    | { type: 'abort', event: InputInitiatedRequest };

export type CollectedEvent = HttpExchange | FailedTlsRequest

export class EventsStore {

    constructor(
        private serverStore: ServerStore,
        private apiStore: ApiStore
    ) { }

    readonly initialized = lazyObservablePromise(async () => {
        await Promise.all([
            this.serverStore.initialized,
            this.apiStore.initialized
        ]);

        const { onServerEvent } = this.serverStore;

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
    private orphanedEvents: { [id: string]: OrphanableQueuedEvent } = {};

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
        switch (queuedEvent.type) {
            case 'request-initiated':
                this.addInitiatedRequest(queuedEvent.event);
                return this.checkForOrphan(queuedEvent.event.id);
            case 'request':
                this.addCompletedRequest(queuedEvent.event);
                return this.checkForOrphan(queuedEvent.event.id);
            case 'response':
                return this.setResponse(queuedEvent.event);
            case 'abort':
                return this.markRequestAborted(queuedEvent.event);
            case 'tlsClientError':
                return this.addFailedTlsRequest(queuedEvent.event);
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
        try {
            // Due to race conditions, it's possible this request already exists. If so,
            // we just skip this - the existing data will be more up to date.
            const existingEventIndex = _.findIndex(this.events, { id: request.id });
            if (existingEventIndex === -1) {
                const exchange = new HttpExchange(this.apiStore, request);
                this.events.push(exchange);
            }
        } catch (e) {
            reportError(e);
        }
    }

    @action
    private addCompletedRequest(request: InputCompletedRequest) {
        try {
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
        } catch (e) {
            reportError(e);
        }
    }

    @action
    private markRequestAborted(request: InputInitiatedRequest) {
        try {
            const exchange = _.find(this.exchanges, { id: request.id });

            if (!exchange) {
                // Handle this later, once the request has arrived
                this.orphanedEvents[request.id] = { type: 'abort', event: request };
                return;
            };

            exchange.markAborted(request);
        } catch (e) {
            reportError(e);
        }
    }

    @action
    private setResponse(response: InputResponse) {
        try {
            const exchange = _.find(this.exchanges, { id: response.id });

            if (!exchange) {
                // Handle this later, once the request has arrived
                this.orphanedEvents[response.id] = { type: 'response', event: response };
                return;
            }

            exchange.setResponse(response);
        } catch (e) {
            reportError(e);
        }
    }

    @action
    private addFailedTlsRequest(request: InputTlsRequest) {
        try {
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
            }));
        } catch (e) {
            reportError(e);
        }
    }

    @action.bound
    deleteEvent(event: CollectedEvent) {
        this.events.remove(event);
    }

    @action.bound
    clearInterceptedData(clearPinned: boolean) {
        const pinnedEvents = clearPinned
            ? []
            : this.events.filter(ex => ex.pinned);

        this.events.clear();

        this.events.push(...pinnedEvents);
        this.orphanedEvents = {};
    }

    async loadFromHar(harContents: {}) {
        const { requests, responses, aborts } = await parseHar(harContents)
            .catch((harParseError: HarParseError) => {
                // Log all suberrors, for easier reporting & debugging.
                // This does not include HAR data - only schema errors like
                // 'bodySize is missing' at 'entries[1].request'
                harParseError.errors.forEach((error) => {
                    console.log(error);
                });
                throw harParseError;
            });

        // Arguably we could call addRequest/setResponse directly, but this is a little
        // nicer just in case the UI thread is already under strain.
        requests.forEach(r => this.eventQueue.push({ type: 'request', event: r }));
        responses.forEach(r => this.eventQueue.push({ type: 'response', event: r }));
        aborts.forEach(r => this.eventQueue.push({ type: 'abort', event: r }));

        this.queueEventFlush();
    }

}