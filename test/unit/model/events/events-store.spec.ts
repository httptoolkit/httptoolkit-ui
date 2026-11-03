import * as _ from 'lodash';
import { expect } from '../../../test-setup';

import { EventsStore, QueuedEvent } from '../../../../src/model/events/events-store';
import { generateHar, parseHar } from '../../../../src/model/http/har';
import { getEventsStore } from '../../unit-test-helpers';

const baseTime = Date.parse('2026-07-17T20:35:23.000Z');
const at = (offsetMs: number) => new Date(baseTime + offsetMs).toISOString();
const atSeconds = (offsetMs: number) => (baseTime + offsetMs) / 1000;

const getEntry = (hostname: string, status: number, fields: {} = {}) => ({
    startedDateTime: at(0),
    time: 100,
    request: {
        method: 'GET',
        url: `https://${hostname}/`,
        httpVersion: 'HTTP/1.1',
        headers: [{ name: 'host', value: hostname }],
        queryString: [],
        cookies: [],
        headersSize: -1,
        bodySize: 0
    },
    response: {
        status,
        statusText: '',
        httpVersion: 'HTTP/1.1',
        headers: [],
        cookies: [],
        content: { size: 5, mimeType: 'text/plain', text: 'hello' },
        redirectURL: '',
        headersSize: -1,
        bodySize: 5
    },
    cache: {},
    timings: { send: 0, wait: 0, receive: 0 },
    ...fields
});

const har = {
    log: {
        version: '1.2',
        creator: { name: 'test', version: '1' },
        entries: [
            getEntry('http.test', 200),
            getEntry('ws.test', 101, {
                _resourceType: 'websocket',
                _webSocketMessages: [
                    { type: 'send', opcode: 1, data: 'first', time: atSeconds(10) },
                    { type: 'receive', opcode: 1, data: 'second', time: atSeconds(20) },
                    { type: 'send', opcode: 1, data: 'third', time: atSeconds(30) }
                ],
                _webSocketClose: { code: 1000, reason: 'done' }
            })
        ],
        _rawTunnels: [{
            startedDateTime: at(0),
            time: 1000,
            clientIPAddress: '10.0.0.1',
            clientPort: 5678,
            hostname: 'tunnel.test',
            port: 1234,
            messages: [
                { type: 'send', opcode: 2, data: 'AQ==', time: atSeconds(100) },
                { type: 'receive', opcode: 2, data: 'Ag==', time: atSeconds(200) }
            ]
        }],
        _rtcConnections: [{
            startedDateTime: at(0),
            time: 5000,
            peerId: 'peer-id',
            metadata: {},
            localSessionDescription: { type: 'answer', sdp: 'local-sdp' },
            remoteSessionDescription: { type: 'offer', sdp: 'remote-sdp' },
            selectedLocalCandidate: { address: '10.0.0.1', port: 1, protocol: 'udp', type: 'host' },
            selectedRemoteCandidate: { address: '10.0.0.2', port: 2, protocol: 'udp', type: 'host' },
            dataChannels: [{
                startedDateTime: at(100),
                time: 1000,
                channelId: 1,
                label: 'chat',
                protocol: '',
                messages: [
                    { type: 'send', opcode: 1, data: 'one', time: atSeconds(200) },
                    { type: 'receive', opcode: 1, data: 'two', time: atSeconds(300) }
                ]
            }],
            mediaTracks: [{
                startedDateTime: at(100),
                time: 3000,
                mid: '0',
                type: 'audio',
                direction: 'sendrecv',
                stats: [
                    { time: atSeconds(1100), totalBytesSent: 10, totalBytesReceived: 20 },
                    { time: atSeconds(2100), totalBytesSent: 30, totalBytesReceived: 40 }
                ]
            }]
        }]
    }
};

// The events which create each item. Anything else for an item, received before these, is orphaned:
const ITEM_CREATING_EVENTS = [
    'request-initiated',
    'request',
    'websocket-request',
    'tls-passthrough-opened',
    'raw-passthrough-opened',
    'peer-connected',
    'data-channel-opened',
    'media-track-opened'
];

const applyEvents = (eventsStore: EventsStore, events: QueuedEvent[]) => {
    eventsStore['eventQueue'].push(...events);
    eventsStore['flushQueuedUpdates']();
};

const exportHar = async (eventsStore: EventsStore) =>
    JSON.parse(JSON.stringify(await generateHar(eventsStore.events)));

describe('Events store', () => {
    it('applies all events received before the item they belong to', async () => {
        const { events } = await parseHar(har);

        const inOrderStore = getEventsStore();
        applyEvents(inOrderStore, events);

        const [creatingEvents, otherEvents] = _.partition(events, e =>
            ITEM_CREATING_EVENTS.includes(e.type)
        );
        const outOfOrderStore = getEventsStore();
        applyEvents(outOfOrderStore, [...otherEvents, ...creatingEvents]);

        const [webSocket] = outOfOrderStore.websockets;
        expect(webSocket.wasAccepted).to.equal(true);
        expect(webSocket.messages.map(m => m.content.toString()))
            .to.deep.equal(['first', 'second', 'third']);
        expect(webSocket.closeState).to.deep.include({ closeCode: 1000 });

        const [channel] = outOfOrderStore.rtcDataChannels;
        expect(channel.messages.map(m => m.content.toString())).to.deep.equal(['one', 'two']);
        expect(channel.closeState).to.not.equal(undefined);

        const [track] = outOfOrderStore.rtcMediaTracks;
        expect(track.totalBytesSent).to.equal(30);
        expect(track.closeState).to.not.equal(undefined);

        const [connection] = outOfOrderStore.rtcConnections;
        expect(connection.closeState).to.not.equal(undefined);

        expect(await exportHar(outOfOrderStore)).to.deep.equal(await exportHar(inOrderStore));
    });

    it('applies TLS tunnel closes received before the tunnel opened', () => {
        const tunnelEvent = {
            id: 'tls-tunnel-id',
            destination: { hostname: 'tls.test', port: 443 },
            remoteIpAddress: '10.0.0.1',
            remotePort: 5678,
            tags: [],
            tlsMetadata: {}
        };

        const eventsStore = getEventsStore();
        applyEvents(eventsStore, [
            {
                type: 'tls-passthrough-closed',
                event: {
                    ...tunnelEvent,
                    timingEvents: { startTime: baseTime, connectTimestamp: 0, disconnectTimestamp: 500 }
                }
            },
            {
                type: 'tls-passthrough-opened',
                event: { ...tunnelEvent, timingEvents: { startTime: baseTime, connectTimestamp: 0 } }
            }
        ]);

        const [tunnel] = eventsStore.events;
        expect(tunnel.isTlsTunnel() && tunnel.isOpen()).to.equal(false);
        expect(tunnel.isTlsTunnel() && tunnel.timingEvents.disconnectTimestamp).to.equal(500);
    });
});
