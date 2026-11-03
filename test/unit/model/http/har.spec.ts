import * as dateFns from 'date-fns';
import { expect } from '../../../test-setup';

import { generateHar, parseHar } from '../../../../src/model/http/har';
import { WebSocketStream } from '../../../../src/model/websockets/websocket-stream';
import { StreamMessage } from '../../../../src/model/events/stream-message';
import { RawTunnel } from '../../../../src/model/raw-tunnel';
import { RTCConnection } from '../../../../src/model/webrtc/rtc-connection';
import { RTCDataChannel } from '../../../../src/model/webrtc/rtc-data-channel';
import { RTCMediaTrack } from '../../../../src/model/webrtc/rtc-media-track';
import { EventsStore } from '../../../../src/model/events/events-store';
import { getExchangeData, getEventsStore } from '../../unit-test-helpers';

describe('HAR generation', () => {
    it('orders entries chronologically regardless of selection order', async () => {
        const olderExchange = getExchangeData({ statusCode: 403 });
        olderExchange.timingEvents.startTime = Date.parse('2026-07-17T20:35:23.997+01:00');

        const newerExchange = getExchangeData({ statusCode: 200 });
        newerExchange.timingEvents.startTime = Date.parse('2026-07-17T20:36:12.733+01:00');

        const har = await generateHar([newerExchange, olderExchange]);

        expect(har.log.entries.map(entry => entry.response.status))
            .to.deep.equal([403, 200]);
    });

    it('exports WebSocket message & close times as epoch seconds', async () => {
        const startTime = Date.parse('2026-07-17T20:35:23.000Z');
        const stream = Object.assign(getExchangeData({ statusCode: 101 }), {
            timingEvents: {
                startTime,
                startTimestamp: 1000,
                wsClosedTimestamp: 3500
            },
            messages: [
                new StreamMessage({
                    streamId: '1',
                    direction: 'received',
                    content: Buffer.from('hi'),
                    isBinary: false,
                    eventTimestamp: 1250,
                    timingEvents: { startTime, startTimestamp: 1000 },
                    tags: []
                }, 0)
            ],
            closeData: { streamId: '1', closeCode: 1000, closeReason: '', timingEvents: {}, tags: [] }
        });
        Object.setPrototypeOf(stream, WebSocketStream.prototype);

        const har = await generateHar([stream]);
        const entry = har.log.entries[0];

        expect(entry._webSocketMessages![0].time).to.equal(startTime / 1000 + 0.25);
        expect(entry._webSocketClose).to.deep.equal({
            code: 1000,
            reason: '',
            timestamp: startTime / 1000 + 2.5
        });
    });
});

describe('HAR parsing', () => {
    const getWebSocketHar = (entryFields: {}, status: number) => ({
        log: {
            version: '1.2',
            creator: { name: 'test', version: '1' },
            entries: [{
                startedDateTime: '2026-07-17T20:35:23.000Z',
                time: 100,
                request: {
                    method: 'GET',
                    url: 'https://example.com/ws',
                    httpVersion: 'HTTP/1.1',
                    headers: [{ name: 'host', value: 'example.com' }],
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
                    content: { size: 0, mimeType: 'text/plain' },
                    redirectURL: '',
                    headersSize: -1,
                    bodySize: 0
                },
                cache: {},
                timings: { send: 0, wait: 0, receive: 0 },
                _resourceType: 'websocket',
                _webSocketMessages: [
                    { type: 'send', opcode: 1, data: 'hi', time: 1784320523.05 }
                ],
                ...entryFields
            }]
        }
    });

    const getEventTypes = async (entryFields: {}, status: number) =>
        (await parseHar(getWebSocketHar(entryFields, status))).events.map(e => e.type);

    it('imports closed WebSockets with their close event', async () => {
        expect(await getEventTypes({
            _webSocketClose: { code: 1000, reason: 'done' }
        }, 101)).to.deep.equal([
            'websocket-request',
            'websocket-accepted',
            'websocket-message-received',
            'websocket-close'
        ]);
    });

    it('skips Chrome error entries in WebSocket messages', async () => {
        const { events } = await parseHar(getWebSocketHar({
            _webSocketMessages: [
                { type: 'send', opcode: 1, data: 'hi', time: 1784320523.05 },
                { type: 'error', opcode: -1, data: 'Invalid frame header', time: 1784320523.06 }
            ]
        }, 101));

        expect(events.map(e => e.type)).to.deep.equal([
            'websocket-request',
            'websocket-accepted',
            'websocket-message-received'
        ]);
    });

    it('imports aborted WebSockets with a single abort', async () => {
        expect(await getEventTypes({ _webSocketClose: 'aborted' }, 101)).to.deep.equal([
            'websocket-request',
            'websocket-accepted',
            'websocket-message-received',
            'abort'
        ]);
    });

    it('imports still-open WebSockets without inventing a close or abort', async () => {
        const { events } = await parseHar(getWebSocketHar({}, 101));

        expect(events.map(e => e.type)).to.deep.equal([
            'websocket-request',
            'websocket-accepted',
            'websocket-message-received'
        ]);

        const requestEvent = events[0];
        if (requestEvent.type !== 'websocket-request') throw new Error('Unexpected first event');

        const { timingEvents } = requestEvent.event;
        expect(timingEvents).to.not.have.property('wsClosedTimestamp');
        expect(timingEvents).to.not.have.property('abortedTimestamp');
    });

    it('imports rejected WebSocket upgrades as a plain response', async () => {
        expect(await getEventTypes({}, 403)).to.deep.equal([
            'websocket-request',
            'response'
        ]);
    });

    it('imports WebSockets aborted before any response with a single abort', async () => {
        expect(await getEventTypes({ _webSocketMessages: [] }, 0)).to.deep.equal([
            'websocket-request',
            'abort'
        ]);
    });
});

describe('HAR raw tunnel support', () => {
    const startTime = Date.parse('2026-07-17T20:35:23.000Z');

    const getTunnel = () => {
        const tunnel = new RawTunnel({
            id: 'tunnel-id',
            destination: { hostname: 'example.com', port: 1234 },
            remoteIpAddress: '10.0.0.1',
            remotePort: 5678,
            tags: [],
            timingEvents: { startTime, connectTimestamp: 1000 }
        });

        tunnel.addChunk({
            id: 'tunnel-id',
            direction: 'received',
            content: Buffer.from('hello'),
            eventTimestamp: 1250
        });
        tunnel.addChunk({
            id: 'tunnel-id',
            direction: 'sent',
            content: Buffer.from([0x00, 0xff, 0xfe, 0x80]),
            eventTimestamp: 1500
        });

        return tunnel;
    };

    const closeTunnel = (tunnel: RawTunnel) => tunnel.markClosed({
        id: 'tunnel-id',
        destination: { hostname: 'example.com', port: 1234 },
        remoteIpAddress: '10.0.0.1',
        remotePort: 5678,
        tags: [],
        timingEvents: { startTime, connectTimestamp: 1000, disconnectTimestamp: 3000 }
    });

    const roundTrip = async (har: unknown) => parseHar(JSON.parse(JSON.stringify(har)));

    it('exports raw tunnels with their packets', async () => {
        const tunnel = getTunnel();
        closeTunnel(tunnel);

        const har = await generateHar([tunnel]);

        expect(har.log.entries).to.deep.equal([]);
        expect(har.log._rawTunnels).to.deep.equal([{
            startedDateTime: dateFns.format(startTime),
            time: 2000,
            clientIPAddress: '10.0.0.1',
            clientPort: 5678,
            hostname: 'example.com',
            port: 1234,
            messages: [
                { type: 'send', opcode: 2, data: Buffer.from('hello').toString('base64'), time: startTime / 1000 + 0.25 },
                { type: 'receive', opcode: 2, data: 'AP/+gA==', time: startTime / 1000 + 0.5 }
            ]
        }]);
    });

    it('omits raw tunnels from HARs without any', async () => {
        const har = await generateHar([getExchangeData()]);
        expect(har.log).to.not.have.property('_rawTunnels');
    });

    it('round-trips closed raw tunnels through HAR import', async () => {
        const tunnel = getTunnel();
        closeTunnel(tunnel);
        tunnel.pinned = true;

        const { events, pinnedIds } = await roundTrip(await generateHar([tunnel]));

        expect(events.map(e => e.type)).to.deep.equal([
            'raw-passthrough-opened',
            'raw-passthrough-data',
            'raw-passthrough-data',
            'raw-passthrough-closed'
        ]);

        const [openEvent, firstData, secondData, closeEvent] = events;
        if (
            openEvent.type !== 'raw-passthrough-opened' ||
            firstData.type !== 'raw-passthrough-data' ||
            secondData.type !== 'raw-passthrough-data' ||
            closeEvent.type !== 'raw-passthrough-closed'
        ) throw new Error('Unexpected event types');

        expect(openEvent.event).to.deep.include({
            destination: { hostname: 'example.com', port: 1234 },
            remoteIpAddress: '10.0.0.1',
            remotePort: 5678
        });
        expect(openEvent.event.timingEvents).to.deep.equal({ startTime, connectTimestamp: 0 });

        expect(firstData.event.direction).to.equal('received');
        expect(Buffer.from(firstData.event.content).toString()).to.equal('hello');
        expect(firstData.event.eventTimestamp).to.be.closeTo(250, 0.001);

        expect(secondData.event.direction).to.equal('sent');
        expect(Buffer.from(secondData.event.content)).to.deep.equal(Buffer.from([0x00, 0xff, 0xfe, 0x80]));
        expect(secondData.event.eventTimestamp).to.be.closeTo(500, 0.001);

        expect(closeEvent.event.timingEvents.disconnectTimestamp).to.equal(2000);
        expect(pinnedIds).to.deep.equal([openEvent.event.id]);
    });

    it('round-trips still-open raw tunnels without a close', async () => {
        const { events } = await roundTrip(await generateHar([getTunnel()]));

        expect(events.map(e => e.type)).to.deep.equal([
            'raw-passthrough-opened',
            'raw-passthrough-data',
            'raw-passthrough-data'
        ]);
    });
});

describe('HAR WebRTC support', () => {
    const startTime = Date.parse('2026-07-17T20:35:23.000Z');
    const timingEvents = { startTime, connectTimestamp: 1000 };
    const sessionDetails = { peerId: 'peer-id', sessionId: 'session-id', timingEvents };

    const candidate = (address: string) => ({
        address,
        port: 1234,
        protocol: 'udp' as const,
        type: 'host' as const
    });

    const getConnection = () => {
        const connection = new RTCConnection({
            ...sessionDetails,
            metadata: { userAgent: 'test-agent', sourceURL: 'https://example.com' },
            localSessionDescription: { type: 'answer', sdp: 'local-sdp' },
            remoteSessionDescription: { type: 'offer', sdp: 'remote-sdp' },
            selectedLocalCandidate: candidate('10.0.0.1'),
            selectedRemoteCandidate: candidate('10.0.0.2')
        });

        const channel = new RTCDataChannel({
            ...sessionDetails,
            channelId: 1,
            channelLabel: 'chat',
            channelProtocol: 'proto',
            eventTimestamp: 1100
        }, connection);
        connection.addStream(channel);

        channel.addMessage({
            ...sessionDetails,
            channelId: 1,
            direction: 'received',
            content: Buffer.from('hello'),
            isBinary: false,
            eventTimestamp: 1250
        });
        channel.addMessage({
            ...sessionDetails,
            channelId: 1,
            direction: 'sent',
            content: Buffer.from([0x00, 0xff]),
            isBinary: true,
            eventTimestamp: 1500
        });
        channel.markClosed({ ...sessionDetails, channelId: 1, eventTimestamp: 2100 });

        const track = new RTCMediaTrack({
            ...sessionDetails,
            trackMid: '0',
            trackType: 'video',
            trackDirection: 'sendrecv',
            eventTimestamp: 1200
        }, connection);
        connection.addStream(track);

        track.addStats({
            ...sessionDetails,
            trackMid: '0',
            totalBytesSent: 100,
            totalBytesReceived: 200,
            eventTimestamp: 2200
        });
        track.addStats({
            ...sessionDetails,
            trackMid: '0',
            totalBytesSent: 150,
            totalBytesReceived: 300,
            eventTimestamp: 3200
        });

        return { connection, channel, track };
    };

    const roundTrip = async (har: unknown) => parseHar(JSON.parse(JSON.stringify(har)));

    it('exports a whole connection when the connection is selected', async () => {
        const { connection } = getConnection();
        connection.markClosed({
            ...sessionDetails,
            timingEvents: { ...timingEvents, disconnectTimestamp: 4000 }
        });

        const har = await generateHar([connection]);

        expect(har.log.entries).to.deep.equal([]);
        expect(har.log._rtcConnections).to.deep.equal([{
            startedDateTime: dateFns.format(startTime),
            time: 3000,
            peerId: 'peer-id',
            metadata: { userAgent: 'test-agent', sourceURL: 'https://example.com' },
            localSessionDescription: { type: 'answer', sdp: 'local-sdp' },
            remoteSessionDescription: { type: 'offer', sdp: 'remote-sdp' },
            selectedLocalCandidate: candidate('10.0.0.1'),
            selectedRemoteCandidate: candidate('10.0.0.2'),
            dataChannels: [{
                startedDateTime: dateFns.format(startTime + 100),
                time: 1000,
                channelId: 1,
                label: 'chat',
                protocol: 'proto',
                messages: [
                    { type: 'send', opcode: 1, data: 'hello', time: startTime / 1000 + 0.25 },
                    { type: 'receive', opcode: 2, data: 'AP8=', time: startTime / 1000 + 0.5 }
                ]
            }],
            mediaTracks: [{
                startedDateTime: dateFns.format(startTime + 200),
                mid: '0',
                type: 'video',
                direction: 'sendrecv',
                stats: [
                    { time: startTime / 1000 + 1.2, totalBytesSent: 100, totalBytesReceived: 200 },
                    { time: startTime / 1000 + 2.2, totalBytesSent: 150, totalBytesReceived: 300 }
                ]
            }]
        }]);
    });

    it('exports only the selected streams of a connection', async () => {
        const { channel } = getConnection();

        const har = await generateHar([channel]);

        expect(har.log._rtcConnections).to.have.length(1);
        const [connection] = har.log._rtcConnections!;
        expect(connection).to.not.have.property('time');
        expect(connection.dataChannels.map(c => c.label)).to.deep.equal(['chat']);
        expect(connection.mediaTracks).to.deep.equal([]);
    });

    it('round-trips connections through HAR import', async () => {
        const { connection, channel } = getConnection();
        connection.markClosed({
            ...sessionDetails,
            timingEvents: { ...timingEvents, disconnectTimestamp: 4000 }
        });
        channel.pinned = true;

        const { events, pinnedIds } = await roundTrip(await generateHar([connection]));

        // The connection's own events, then each stream's, in order of opening:
        expect(events.map(e => e.type)).to.deep.equal([
            'peer-connected',
            'peer-disconnected',
            'data-channel-opened',
            'data-channel-message-received',
            'data-channel-message-sent',
            'data-channel-closed',
            'media-track-opened',
            'media-track-stats',
            'media-track-stats'
        ]);

        const [
            connectedEvent,
            disconnectedEvent,
            channelOpenedEvent,
            receivedEvent,
            sentEvent,
            channelClosedEvent,
            trackOpenedEvent,
            firstStatsEvent,
            secondStatsEvent
        ] = events;
        if (
            connectedEvent.type !== 'peer-connected' ||
            channelOpenedEvent.type !== 'data-channel-opened' ||
            receivedEvent.type !== 'data-channel-message-received' ||
            sentEvent.type !== 'data-channel-message-sent' ||
            channelClosedEvent.type !== 'data-channel-closed' ||
            trackOpenedEvent.type !== 'media-track-opened' ||
            firstStatsEvent.type !== 'media-track-stats' ||
            secondStatsEvent.type !== 'media-track-stats' ||
            disconnectedEvent.type !== 'peer-disconnected'
        ) throw new Error('Unexpected event types');

        const { sessionId } = connectedEvent.event;
        expect(sessionId).to.not.equal('session-id');
        expect(connectedEvent.event).to.deep.include({
            peerId: 'peer-id',
            metadata: { userAgent: 'test-agent', sourceURL: 'https://example.com' },
            localSessionDescription: { type: 'answer', sdp: 'local-sdp' },
            selectedRemoteCandidate: candidate('10.0.0.2'),
            timingEvents: { startTime, connectTimestamp: 0 }
        });

        expect(channelOpenedEvent.event).to.deep.include({
            sessionId,
            channelId: 1,
            channelLabel: 'chat',
            channelProtocol: 'proto',
            eventTimestamp: 100
        });

        expect(receivedEvent.event.isBinary).to.equal(false);
        expect(receivedEvent.event.content.toString()).to.equal('hello');
        expect(receivedEvent.event.eventTimestamp).to.be.closeTo(250, 0.001);
        expect(sentEvent.event.isBinary).to.equal(true);
        expect(sentEvent.event.content).to.deep.equal(Buffer.from([0x00, 0xff]));

        expect(channelClosedEvent.event.eventTimestamp).to.equal(1100);

        expect(trackOpenedEvent.event).to.deep.include({
            trackMid: '0',
            trackType: 'video',
            trackDirection: 'sendrecv',
            eventTimestamp: 200
        });
        expect(secondStatsEvent.event).to.deep.include({
            totalBytesSent: 150,
            totalBytesReceived: 300
        });
        expect(secondStatsEvent.event.eventTimestamp).to.be.closeTo(2200, 0.001);

        expect(disconnectedEvent.event.timingEvents.disconnectTimestamp).to.equal(3000);
        expect(pinnedIds).to.deep.equal([`${sessionId}:data:1`]);
    });
});

describe('HAR import into the events store', function () {
    this.timeout(5000);

    const baseTime = Date.parse('2026-07-17T20:35:23.000Z');
    const getDateTime = (offsetMs: number) => new Date(baseTime + offsetMs).toISOString();

    const getHttpEntry = (hostname: string, offsetMs: number, fields: {} = {}) => ({
        startedDateTime: getDateTime(offsetMs),
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
            status: 200,
            statusText: 'OK',
            httpVersion: 'HTTP/1.1',
            headers: [],
            cookies: [],
            content: { size: 0, mimeType: 'text/plain' },
            redirectURL: '',
            headersSize: -1,
            bodySize: 0
        },
        cache: {},
        timings: { send: 0, wait: 0, receive: 0 },
        ...fields
    });

    const getTlsError = (hostname: string, offsetMs: number) => ({
        startedDateTime: getDateTime(offsetMs),
        time: 10,
        hostname,
        cause: 'cert-rejected',
        tlsMetadata: { sniHostname: hostname }
    });

    const getRawTunnel = (hostname: string, offsetMs: number) => ({
        startedDateTime: getDateTime(offsetMs),
        time: 1000,
        clientIPAddress: '10.0.0.1',
        clientPort: 5678,
        hostname,
        port: 1234,
        messages: [{ type: 'send', opcode: 2, data: 'AP8=', time: (baseTime + offsetMs + 10) / 1000 }]
    });

    const getWebSocketEntry = (hostname: string, offsetMs: number, status: number, fields: {} = {}) =>
        getHttpEntry(hostname, offsetMs, {
            response: { ...getHttpEntry(hostname, offsetMs).response, status },
            _resourceType: 'websocket',
            ...fields
        });

    const candidate = (address: string) => ({ address, port: 1234, protocol: 'udp', type: 'host' });

    const getRtcConnection = (offsetMs: number, fields: {} = {}) => ({
        startedDateTime: getDateTime(offsetMs),
        peerId: 'peer-id',
        metadata: { userAgent: 'test-agent' },
        localSessionDescription: { type: 'answer', sdp: 'local-sdp' },
        remoteSessionDescription: { type: 'offer', sdp: 'remote-sdp' },
        selectedLocalCandidate: candidate('10.0.0.1'),
        selectedRemoteCandidate: candidate('10.0.0.2'),
        dataChannels: [],
        mediaTracks: [],
        ...fields
    });

    const getDataChannel = (label: string, offsetMs: number, fields: {} = {}) => ({
        startedDateTime: getDateTime(offsetMs),
        channelId: 1,
        label,
        protocol: '',
        messages: [{ type: 'send', opcode: 1, data: 'hello', time: (baseTime + offsetMs + 10) / 1000 }],
        ...fields
    });

    const getHar = (log: {}) => ({
        log: {
            version: '1.2',
            creator: { name: 'test', version: '1' },
            entries: [],
            ...log
        }
    });

    const importHar = async (eventsStore: EventsStore, harContents: {}) => {
        await eventsStore.loadFromHar(harContents);
        // Queued events are flushed within at most 500ms:
        await new Promise((resolve) => setTimeout(resolve, 600));
    };

    it('orders all imported traffic by start time', async () => {
        const eventsStore = getEventsStore();
        await importHar(eventsStore, getHar({
            entries: [
                getHttpEntry('http-2s.test', 2000),
                getWebSocketEntry('ws-0s.test', 0, 101, {
                    _webSocketMessages: [
                        { type: 'send', opcode: 1, data: 'hi', time: (baseTime + 50) / 1000 }
                    ],
                    _webSocketClose: { code: 1000, reason: '' }
                })
            ],
            _tlsErrors: [getTlsError('tls-1s.test', 1000)],
            _rawTunnels: [
                getRawTunnel('tunnel-3s.test', 3000),
                getRawTunnel('tunnel-minus-1s.test', -1000)
            ]
        }));

        expect(eventsStore.events.map(e =>
            e.isHttp()
                ? e.request.parsedUrl.hostname
            : e.isTlsFailure()
                ? e.upstreamHostname
            : e.isRawTunnel()
                ? e.upstreamHostname
            : 'unexpected'
        )).to.deep.equal([
            'tunnel-minus-1s.test',
            'ws-0s.test',
            'tls-1s.test',
            'http-2s.test',
            'tunnel-3s.test'
        ]);

        // Each item's own events are still applied together & in order:
        const [webSocket] = eventsStore.websockets;
        expect(webSocket.wasAccepted).to.equal(true);
        expect(webSocket.messages.map(m => m.content.toString())).to.deep.equal(['hi']);
        expect(webSocket.closeState).to.deep.include({ closeCode: 1000 });

        const tunnels = eventsStore.events.filter(e => e.isRawTunnel());
        expect(tunnels.map(t => t.isRawTunnel() && t.packets.length)).to.deep.equal([1, 1]);
    });

    it('imports WebSockets, raw tunnels & WebRTC traffic as the matching models', async () => {
        const eventsStore = getEventsStore();
        await importHar(eventsStore, getHar({
            entries: [
                getWebSocketEntry('open-ws.test', 0, 101, {
                    _webSocketMessages: [
                        { type: 'send', opcode: 1, data: 'hi', time: (baseTime + 50) / 1000 }
                    ]
                }),
                getWebSocketEntry('rejected-ws.test', 100, 403)
            ],
            _rawTunnels: [{ ...getRawTunnel('tunnel.test', 200), pinned: true }],
            _rtcConnections: [getRtcConnection(300, {
                dataChannels: [getDataChannel('chat', 300)],
                mediaTracks: [{
                    startedDateTime: getDateTime(300),
                    time: 3000,
                    mid: '0',
                    type: 'audio',
                    direction: 'sendrecv',
                    stats: [{ time: (baseTime + 1300) / 1000, totalBytesSent: 10, totalBytesReceived: 20 }]
                }]
            })]
        }));

        const [openWebSocket, rejectedWebSocket] = eventsStore.websockets;

        expect(openWebSocket.wasAccepted).to.equal(true);
        expect(openWebSocket.closeState).to.equal(undefined);
        expect(openWebSocket.messages.map(m => m.content.toString())).to.deep.equal(['hi']);

        expect(rejectedWebSocket.wasAccepted).to.equal(false);
        expect(rejectedWebSocket.isSuccessfulExchange() && rejectedWebSocket.response.statusCode)
            .to.equal(403);

        const tunnel = eventsStore.events.find(e => e.isRawTunnel());
        if (!tunnel?.isRawTunnel()) throw new Error('No tunnel imported');
        expect(tunnel.isOpen()).to.equal(false);
        expect(tunnel.pinned).to.equal(true);
        expect(tunnel.packets.map(p => p.content)).to.deep.equal([Buffer.from([0x00, 0xff])]);

        const [connection] = eventsStore.rtcConnections;
        expect(connection.closeState).to.equal(undefined);
        expect(connection.streams).to.have.length(2);

        const [channel] = eventsStore.rtcDataChannels;
        expect(channel.label).to.equal('chat');
        expect(channel.closeState).to.equal(undefined);
        expect(channel.messages.map(m => [m.direction, m.content.toString()]))
            .to.deep.equal([['received', 'hello']]);

        const [track] = eventsStore.rtcMediaTracks;
        expect(track.closeState).to.not.equal(undefined);
        expect(track.totalBytesSent).to.equal(10);
        expect(track.totalBytesReceived).to.equal(20);
    });

    it('orders WebRTC streams by when they opened', async () => {
        const eventsStore = getEventsStore();
        await importHar(eventsStore, getHar({
            entries: [getHttpEntry('http-1s.test', 1000)],
            _rtcConnections: [getRtcConnection(0, {
                dataChannels: [
                    getDataChannel('channel-2s', 2000),
                    // Before the connection started, so can only be added after it:
                    getDataChannel('channel-minus-1s', -1000, { channelId: 2 })
                ]
            })]
        }));

        expect(eventsStore.events.map(e =>
            e.isHttp()
                ? e.request.parsedUrl.hostname
            : e.isRTCConnection()
                ? 'connection'
            : e.isRTCDataChannel()
                ? e.label
            : 'unexpected'
        )).to.deep.equal([
            'connection',
            'channel-minus-1s',
            'http-1s.test',
            'channel-2s'
        ]);

        const [connection] = eventsStore.rtcConnections;
        expect(connection.streams.map(s => s.isRTCDataChannel() && s.label))
            .to.deep.equal(['channel-minus-1s', 'channel-2s']);
    });

    it('re-imports its own exports equivalently', async () => {
        const firstStore = getEventsStore();
        await importHar(firstStore, getHar({
            entries: [
                getHttpEntry('http.test', 0),
                getWebSocketEntry('ws.test', 100, 101, {
                    _webSocketMessages: [
                        { type: 'send', opcode: 1, data: 'hi', time: (baseTime + 150) / 1000 }
                    ],
                    _webSocketClose: { code: 1000, reason: 'done' }
                })
            ],
            _tlsErrors: [getTlsError('tls.test', 200)],
            _rawTunnels: [getRawTunnel('tunnel.test', 300)],
            _rtcConnections: [getRtcConnection(400, {
                dataChannels: [getDataChannel('chat', 500)]
            })]
        }));

        const exported = JSON.parse(JSON.stringify(await generateHar(firstStore.events)));

        const secondStore = getEventsStore();
        await importHar(secondStore, exported);

        const reexported = JSON.parse(JSON.stringify(await generateHar(secondStore.events)));
        expect(reexported.log.entries).to.deep.equal(exported.log.entries);
        expect(reexported.log._tlsErrors).to.deep.equal(exported.log._tlsErrors);
        expect(reexported.log._rawTunnels).to.deep.equal(exported.log._rawTunnels);
        expect(reexported.log._rtcConnections).to.deep.equal(exported.log._rtcConnections);
    });
});
