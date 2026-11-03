import { expect } from "../../../test-setup";

import { RequestInput } from "../../../../src/model/send/send-request-model";
import {
    generateCodeSnippetFromRequestInput,
    estimateHarSize,
    planBulkHarExport
} from "../../../../src/model/ui/export";
import { RawTunnel } from "../../../../src/model/raw-tunnel";
import { RTCConnection } from "../../../../src/model/webrtc/rtc-connection";
import { RTCDataChannel } from "../../../../src/model/webrtc/rtc-data-channel";
import { getExchangeData } from "../../unit-test-helpers";
import { getCodeSnippetOptionFromKey } from "../../../../src/model/ui/snippet-formats";

const curlFormat = getCodeSnippetOptionFromKey('shell~~curl');

describe("Code snippet generation from Send request inputs", () => {

    it("should generate a curl snippet for a simple GET request", () => {
        const requestInput = new RequestInput({
            method: 'GET',
            url: 'https://example.com/path?a=b',
            headers: [
                ['host', 'example.com'],
                ['accept', 'application/json']
            ],
            requestContentType: 'text',
            rawBody: Buffer.from([])
        });

        const snippet = generateCodeSnippetFromRequestInput(requestInput, curlFormat);

        expect(snippet).to.include('curl');
        expect(snippet).to.include('https://example.com/path?a=b');
        expect(snippet).to.include("--header 'accept: application/json'");
    });

    it("should generate a curl snippet including the body for a POST request", () => {
        const requestInput = new RequestInput({
            method: 'POST',
            url: 'https://example.com/upload',
            headers: [
                ['host', 'example.com'],
                ['content-type', 'application/json'],
                ['content-length', '18']
            ],
            requestContentType: 'json',
            rawBody: Buffer.from('{"hello":"world"}')
        });

        const snippet = generateCodeSnippetFromRequestInput(requestInput, curlFormat);

        expect(snippet).to.include('--request POST');
        expect(snippet).to.include('https://example.com/upload');
        expect(snippet).to.include("--header 'content-type: application/json'");
        expect(snippet).to.include('{"hello":"world"}');

        // Content-length is dropped, as clients can calculate it themselves:
        expect(snippet).to.not.include('content-length');
    });

    it("should drop content-encoding headers and use the decoded body", () => {
        const requestInput = new RequestInput({
            method: 'POST',
            url: 'https://example.com/',
            headers: [
                ['host', 'example.com'],
                ['content-type', 'text/plain'],
                ['content-encoding', 'gzip']
            ],
            requestContentType: 'text',
            rawBody: Buffer.from('plain text body')
        });

        const snippet = generateCodeSnippetFromRequestInput(requestInput, curlFormat);

        expect(snippet).to.include('plain text body');
        expect(snippet).to.not.include('content-encoding');
    });

    it("should fail clearly given an invalid URL", () => {
        const requestInput = new RequestInput({
            method: 'GET',
            url: 'not-a-real-url',
            headers: [],
            requestContentType: 'text',
            rawBody: Buffer.from([])
        });

        expect(() =>
            generateCodeSnippetFromRequestInput(requestInput, curlFormat)
        ).to.throw();
    });

});

describe("HAR export size checks", () => {

    const MB = 1_000_000;

    it("estimates sizes from HTTP bodies & stream messages, counting each stream once", async () => {
        const exchange = getExchangeData({
            requestBody: Buffer.alloc(1000),
            responseBody: Buffer.alloc(5000)
        });

        const tunnel = new RawTunnel({
            id: 'tunnel-id',
            destination: { hostname: 'example.com', port: 1234 },
            remoteIpAddress: '10.0.0.1',
            remotePort: 5678,
            tags: [],
            timingEvents: { startTime: 0, connectTimestamp: 0 }
        });
        tunnel.addChunk({ id: 'tunnel-id', direction: 'sent', content: Buffer.alloc(300), eventTimestamp: 0 });

        const sessionDetails = {
            peerId: 'peer-id',
            sessionId: 'session-id',
            timingEvents: { startTime: 0, connectTimestamp: 0 }
        };
        const candidate = { address: '10.0.0.1', port: 1, protocol: 'udp' as const, type: 'host' as const };
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
            content: Buffer.alloc(MB),
            isBinary: true,
            eventTimestamp: 0
        });

        expect(await estimateHarSize([])).to.deep.equal({ totalSize: 0, httpBodies: [] });

        const httpEstimate = await estimateHarSize([exchange]);
        const tunnelEstimate = await estimateHarSize([tunnel]);
        const channelEstimate = await estimateHarSize([channel]);
        const connectionEstimate = await estimateHarSize([connection]);
        const connectionAndChannelEstimate = await estimateHarSize([connection, channel]);

        expect(httpEstimate.httpBodies.map(({ size }) => size)).to.deep.equal([1000, 5000]);
        expect(tunnelEstimate.httpBodies).to.deep.equal([]);

        // Sizes are rough, but must scale with the content, and count each stream once:
        expect(httpEstimate.totalSize).to.be.at.least(6000);
        expect(tunnelEstimate.totalSize).to.be.at.least(300);
        expect(channelEstimate.totalSize).to.be.at.least(MB);
        expect(connectionEstimate.totalSize).to.be.at.least(MB);
        expect(connectionAndChannelEstimate.totalSize - connectionEstimate.totalSize)
            .to.be.lessThan(MB);
    });

    const bodies = (...sizesInMB: number[]) =>
        sizesInMB.map((sizeInMB, i) => ({ body: `body-${i}`, size: sizeInMB * MB }));

    it("estimates binary content at its base64-encoded size", async () => {
        const textExchange = getExchangeData({ responseBody: Buffer.alloc(3000, 'a') });
        const binaryExchange = getExchangeData({ responseBody: Buffer.alloc(3000, 0xff) });

        const textEstimate = await estimateHarSize([textExchange]);
        const binaryEstimate = await estimateHarSize([binaryExchange]);

        expect(textEstimate.httpBodies.map(({ size }) => size)).to.deep.equal([0, 3000]);
        expect(binaryEstimate.httpBodies.map(({ size }) => size)).to.deep.equal([0, 4000]);
    });

    it("exports everything when under 300MB", () => {
        expect(planBulkHarExport({ totalSize: 299 * MB, httpBodies: bodies(150) }))
            .to.deep.equal({ kind: 'export', droppedBodies: new Set() });
    });

    it("drops the largest bodies until under 300MB", () => {
        expect(planBulkHarExport({ totalSize: 350 * MB, httpBodies: bodies(20, 40, 1, 30) }))
            .to.deep.equal({ kind: 'export', droppedBodies: new Set(['body-1', 'body-3']) });
    });

    it("drops only as many same-sized bodies as needed", () => {
        expect(planBulkHarExport({ totalSize: 350 * MB, httpBodies: bodies(60, 60, 60, 60) }))
            .to.deep.equal({ kind: 'export', droppedBodies: new Set(['body-0']) });
    });

    it("exports without dropping anything if there are no bodies to drop", () => {
        expect(planBulkHarExport({ totalSize: 400 * MB, httpBodies: bodies(0, 0) }))
            .to.deep.equal({ kind: 'export', droppedBodies: new Set() });
    });

    it("exports over 300MB if dropping every body still leaves it under 450MB", () => {
        expect(planBulkHarExport({ totalSize: 440 * MB, httpBodies: bodies(10) }))
            .to.deep.equal({ kind: 'export', droppedBodies: new Set(['body-0']) });
    });

    it("refuses exports still over 450MB after dropping bodies", () => {
        expect(planBulkHarExport({ totalSize: 600 * MB, httpBodies: bodies(100) }))
            .to.deep.equal({ kind: 'too-large' });
    });

});
