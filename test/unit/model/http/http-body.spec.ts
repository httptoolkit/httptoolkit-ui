import * as zlib from 'zlib';
import { autorun } from 'mobx';

import { expect } from '../../../test-setup';

import { HttpBody } from '../../../../src/model/http/http-body';
import { delay } from '../../../../src/util/promise';

// Convenience for the legacy (one-shot) constructor: builds the partial InputMessage shape
// that HttpBody actually reads from. Cast through unknown to avoid having to mock the full
// InputMessage interface in every test.
const legacyMessage = (body: Buffer | { buffer: Buffer } | { encodedLength: number, decoded: Buffer } | undefined) =>
    ({ body }) as unknown as Parameters<typeof HttpBody.prototype.constructor>[0];

describe('HttpBody', function () {

    // The first worker round-trip in Karma can take a couple of seconds (see worker-decoding.spec.ts);
    // warm it up once so the per-test timeouts don't have to absorb that.
    before(async function () {
        this.timeout(10000);
        const warmup = new HttpBody(
            legacyMessage(zlib.gzipSync('warmup')),
            { 'content-encoding': 'gzip' }
        );
        await warmup.waitForDecoding();
    });

    describe('legacy one-shot construction', () => {

        it('treats a missing body as a completed empty body', () => {
            const body = new HttpBody({} as any, {});

            expect(body.encodedByteLength).to.equal(0);
            expect(body.isComplete()).to.equal(true);
            expect(body.isAborted()).to.equal(false);
            expect(body.isPending()).to.equal(true);
            expect(body.isFailed()).to.equal(false);
        });

        it('accepts a raw Buffer body', () => {
            const body = new HttpBody(legacyMessage(Buffer.from('hello')), {});

            expect(body.encodedByteLength).to.equal(5);
            expect(body.isComplete()).to.equal(true);
        });

        it('accepts a { buffer: Buffer } body', () => {
            const body = new HttpBody(legacyMessage({ buffer: Buffer.from('hello world') }), {});

            expect(body.encodedByteLength).to.equal(11);
            expect(body.isComplete()).to.equal(true);
        });

        it('accepts a HAR-style body with pre-decoded data', () => {
            const decoded = Buffer.from('decoded text');
            const body = new HttpBody(
                legacyMessage({ encodedLength: 999, decoded }),
                {}
            );

            expect(body.encodedByteLength).to.equal(999);
            expect(body.isDecoded()).to.equal(true);
            expect(body.decodedData!.toString()).to.equal('decoded text');
        });

        it('decodes an identity-encoded body on demand', async () => {
            const body = new HttpBody(legacyMessage(Buffer.from('hello')), {});

            const decoded = await body.waitForDecoding();
            expect(decoded!.toString()).to.equal('hello');
            expect(body.isDecoded()).to.equal(true);
        });

        it('decodes a gzip body via the worker on demand', async function () {
            this.timeout(2000);
            const gzipped = Buffer.from(zlib.gzipSync('compressed payload'));
            const body = new HttpBody(legacyMessage(gzipped), { 'content-encoding': 'gzip' });

            const decoded = await body.waitForDecoding();
            expect(decoded!.toString()).to.equal('compressed payload');
        });

        it('exposes recovered encoded bytes when decoding fails', async function () {
            this.timeout(2000);
            const notActuallyGzip = Buffer.from('definitely not gzip');
            const body = new HttpBody(
                legacyMessage(notActuallyGzip),
                { 'content-encoding': 'gzip' }
            );

            const decoded = await body.waitForDecoding();

            expect(decoded).to.equal(undefined);
            expect(body.isFailed()).to.equal(true);
            expect(body.encodedData!.toString()).to.equal('definitely not gzip');
            expect(body.decodingError).to.exist;
        });
    });

    describe('streaming construction', () => {

        it('starts in a streaming state with no chunks', () => {
            const body = HttpBody.streaming({});

            expect(body.encodedByteLength).to.equal(0);
            expect(body.isComplete()).to.equal(false);
            expect(body.isAborted()).to.equal(false);
            expect(body.isPending()).to.equal(true);
            expect(body.isFailed()).to.equal(false);
        });

        it('reports encodedByteLength reactively as chunks arrive', () => {
            const body = HttpBody.streaming({});
            const observed: number[] = [];

            const dispose = autorun(() => observed.push(body.encodedByteLength));

            body.appendChunk(Buffer.from('hello'));
            body.appendChunk(Buffer.from(' world'));

            expect(body.encodedByteLength).to.equal(11);
            expect(observed).to.deep.equal([0, 5, 11]);

            dispose();
        });

        it('flips isComplete observably when the body is marked complete', () => {
            const body = HttpBody.streaming({});
            const observed: boolean[] = [];

            const dispose = autorun(() => observed.push(body.isComplete()));

            body.markBodyComplete();

            expect(observed).to.deep.equal([false, true]);
            expect(body.isAborted()).to.equal(false);

            dispose();
        });

        it('flips both isComplete and isAborted on abort', () => {
            const body = HttpBody.streaming({});
            body.appendChunk(Buffer.from('partial'));
            body.markBodyAborted();

            expect(body.isComplete()).to.equal(true);
            expect(body.isAborted()).to.equal(true);
        });

        it('rejects appendChunk after markBodyComplete', () => {
            const body = HttpBody.streaming({});
            body.markBodyComplete();

            expect(() => body.appendChunk(Buffer.from('x'))).to.throw(/completed/);
        });

        it('rejects appendChunk after markBodyAborted', () => {
            const body = HttpBody.streaming({});
            body.markBodyAborted();

            expect(() => body.appendChunk(Buffer.from('x'))).to.throw(/aborted/);
        });

        it('rejects double markBodyComplete', () => {
            const body = HttpBody.streaming({});
            body.markBodyComplete();

            expect(() => body.markBodyComplete()).to.throw();
        });

        it('rejects markBodyAborted after markBodyComplete', () => {
            const body = HttpBody.streaming({});
            body.markBodyComplete();

            expect(() => body.markBodyAborted()).to.throw();
        });
    });

    describe('streaming decoding', () => {

        it('does not resolve waitForDecoding until the body is complete', async () => {
            const body = HttpBody.streaming({});

            let resolved = false;
            const decodePromise = body.waitForDecoding().then((decoded) => {
                resolved = true;
                return decoded;
            });

            body.appendChunk(Buffer.from('hello'));
            await delay(10);
            expect(resolved).to.equal(false);

            body.appendChunk(Buffer.from(' world'));
            await delay(10);
            expect(resolved).to.equal(false);

            body.markBodyComplete();
            const decoded = await decodePromise;

            expect(resolved).to.equal(true);
            expect(decoded!.toString()).to.equal('hello world');
        });

        it('decodes identity content received as chunks', async () => {
            const body = HttpBody.streaming({});
            body.appendChunk(Buffer.from('one '));
            body.appendChunk(Buffer.from('two '));
            body.appendChunk(Buffer.from('three'));
            body.markBodyComplete();

            const decoded = await body.waitForDecoding();
            expect(decoded!.toString()).to.equal('one two three');
        });

        it('decodes gzip content received as chunks via the worker', async function () {
            this.timeout(2000);
            const gzipped = Buffer.from(zlib.gzipSync('streaming gzip content'));
            const split = Math.floor(gzipped.length / 2);

            const body = HttpBody.streaming({ 'content-encoding': 'gzip' });
            body.appendChunk(gzipped.subarray(0, split));
            body.appendChunk(gzipped.subarray(split));
            body.markBodyComplete();

            const decoded = await body.waitForDecoding();
            expect(decoded!.toString()).to.equal('streaming gzip content');
        });

        it('decodes an aborted identity body as the partial bytes', async () => {
            const body = HttpBody.streaming({});
            body.appendChunk(Buffer.from('partial'));
            body.markBodyAborted();

            const decoded = await body.waitForDecoding();
            expect(decoded!.toString()).to.equal('partial');
        });

        it('surfaces a decode failure for an aborted body whose partial bytes are not decodable', async function () {
            this.timeout(2000);
            const garbage = Buffer.from('not gzip at all');

            const body = HttpBody.streaming({ 'content-encoding': 'gzip' });
            body.appendChunk(garbage);
            body.markBodyAborted();

            const decoded = await body.waitForDecoding();
            expect(decoded).to.equal(undefined);
            expect(body.isFailed()).to.equal(true);
            expect(body.encodedData!.toString()).to.equal('not gzip at all');
        });

        it('integrates: lazy decodedData reads trigger deferred decoding', async () => {
            const body = HttpBody.streaming({});

            // Reading decodedData while still streaming queues a decode without resolving it.
            expect(body.decodedData).to.equal(undefined);
            expect(body.isPending()).to.equal(true);

            body.appendChunk(Buffer.from('hello'));
            expect(body.decodedData).to.equal(undefined);

            body.markBodyComplete();
            await body.waitForDecoding();

            expect(body.decodedData!.toString()).to.equal('hello');
            expect(body.isDecoded()).to.equal(true);
        });
    });

    describe('cleanup', () => {

        it('resets a completed body to a valid empty decoded state', () => {
            const body = new HttpBody(legacyMessage(Buffer.from('hello')), {});
            body.cleanup();

            expect(body.encodedByteLength).to.equal(0);
            expect(body.isComplete()).to.equal(true);
            expect(body.isAborted()).to.equal(false);
            expect(body.isDecoded()).to.equal(true);
            expect(body.decodedData!.length).to.equal(0);
        });

        it('drops accumulated streaming chunks', async () => {
            const body = HttpBody.streaming({});
            body.appendChunk(Buffer.from('chunk one'));
            body.appendChunk(Buffer.from('chunk two'));
            body.markBodyComplete();

            body.cleanup();

            expect(body.encodedByteLength).to.equal(0);
            expect(body.isComplete()).to.equal(true);
            const decoded = await body.waitForDecoding();
            expect(decoded!.length).to.equal(0);
        });
    });
});
