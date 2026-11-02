import * as dateFns from 'date-fns';
import { expect } from '../../../test-setup';

import { generateHar, parseHar } from '../../../../src/model/http/har';
import { WebSocketStream } from '../../../../src/model/websockets/websocket-stream';
import { StreamMessage } from '../../../../src/model/events/stream-message';
import { RawTunnel } from '../../../../src/model/raw-tunnel';
import { getExchangeData } from '../../unit-test-helpers';

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
