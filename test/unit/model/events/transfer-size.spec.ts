import * as zlib from 'zlib';

import { expect } from "../../../test-setup";

import { getTransferSize } from "../../../../src/model/events/transfer-size";
import { StreamMessage } from "../../../../src/model/events/stream-message";
import { WebSocketStream } from "../../../../src/model/websockets/websocket-stream";
import { RawTunnel } from "../../../../src/model/raw-tunnel";
import { RTCConnection } from "../../../../src/model/webrtc/rtc-connection";
import { RTCDataChannel } from "../../../../src/model/webrtc/rtc-data-channel";
import { RTCMediaTrack } from "../../../../src/model/webrtc/rtc-media-track";
import { getExchangeData, getFailedTls } from "../../unit-test-helpers";

describe("Event transfer size", () => {

    it("is zero for no events", () => {
        expect(getTransferSize([])).to.equal(0);
    });

    it("counts HTTP headers & encoded bodies", () => {
        const encodedBody = zlib.gzipSync(Buffer.alloc(100_000, 'a'));
        const exchange = getExchangeData({
            requestHeaders: { host: 'example.com' }, // 'host: example.com\r\n'
            requestBody: Buffer.alloc(1000),
            responseBody: encodedBody,
            responseHeaders: { 'content-encoding': 'gzip' }
        });

        expect(getTransferSize([exchange])).to.equal(19 + 1000 + encodedBody.byteLength);
    });

    it("counts WebSocket headers & messages", () => {
        const stream = Object.assign(getExchangeData({
            statusCode: 101,
            requestHeaders: { host: 'example.com' } // 'host: example.com\r\n'
        }), {
            messages: [
                new StreamMessage({
                    streamId: '1',
                    direction: 'received',
                    content: Buffer.alloc(300),
                    isBinary: true,
                    eventTimestamp: 0,
                    timingEvents: { startTime: 0, startTimestamp: 0 },
                    tags: []
                }, 0)
            ]
        });
        Object.setPrototypeOf(stream, WebSocketStream.prototype);
        if (!stream.isSuccessfulExchange()) throw new Error('WebSocket was not accepted');
        stream.response.rawHeaders = [['upgrade', 'websocket']]; // 'upgrade: websocket\r\n'

        expect(getTransferSize([stream])).to.equal(19 + 20 + 300);
    });

    it("counts raw tunnel packets", () => {
        const tunnel = new RawTunnel({
            id: 'tunnel-id',
            destination: { hostname: 'example.com', port: 1234 },
            remoteIpAddress: '10.0.0.1',
            remotePort: 5678,
            tags: [],
            timingEvents: { startTime: 0, connectTimestamp: 0 }
        });
        tunnel.addChunk({ id: 'tunnel-id', direction: 'sent', content: Buffer.alloc(300), eventTimestamp: 0 });
        tunnel.addChunk({ id: 'tunnel-id', direction: 'received', content: Buffer.alloc(50), eventTimestamp: 1 });

        expect(getTransferSize([tunnel])).to.equal(350);
    });

    it("counts nothing for TLS failures", () => {
        expect(getTransferSize([getFailedTls()])).to.equal(0);
    });

    describe("for WebRTC", () => {

        const sessionDetails = {
            peerId: 'peer-id',
            sessionId: 'session-id',
            timingEvents: { startTime: 0, connectTimestamp: 0 }
        };
        const candidate = { address: '10.0.0.1', port: 1, protocol: 'udp' as const, type: 'host' as const };

        const getConnection = () => {
            const connection = new RTCConnection({
                ...sessionDetails,
                metadata: {},
                localSessionDescription: { type: 'answer', sdp: '' },
                remoteSessionDescription: { type: 'offer', sdp: '' },
                selectedLocalCandidate: candidate,
                selectedRemoteCandidate: candidate
            });

            const channel = new RTCDataChannel({
                ...sessionDetails,
                channelId: 1,
                channelLabel: 'chat',
                channelProtocol: '',
                eventTimestamp: 0
            }, connection);
            connection.addStream(channel);
            channel.addMessage({
                ...sessionDetails,
                channelId: 1,
                direction: 'sent',
                content: Buffer.alloc(1000),
                isBinary: true,
                eventTimestamp: 0
            });

            const track = new RTCMediaTrack({
                ...sessionDetails,
                trackMid: '0',
                trackType: 'video',
                trackDirection: 'sendrecv',
                eventTimestamp: 0
            }, connection);
            connection.addStream(track);
            track.addStats({
                ...sessionDetails,
                trackMid: '0',
                totalBytesSent: 150,
                totalBytesReceived: 300,
                eventTimestamp: 1000
            });

            return { connection, channel, track };
        };

        it("counts data channel messages & media track bytes", () => {
            const { channel, track } = getConnection();

            expect(getTransferSize([channel])).to.equal(1000);
            expect(getTransferSize([track])).to.equal(450);
        });

        it("counts all streams for connections, each only once", () => {
            const { connection, channel, track } = getConnection();

            expect(getTransferSize([connection])).to.equal(1450);
            expect(getTransferSize([connection, channel, track])).to.equal(1450);
        });

    });

});
