import * as zlib from 'zlib';

import { observable } from 'mobx';

import { expect } from '../../../test-setup';

import { EditableBody } from '../../../../src/model/http/editable-body';
import { delay } from '../../../../src/util/promise';

describe("Editable bodies", () => {

    it("should expose non-encoded encoding results immediately", async () => {
        const body = new EditableBody(
            Buffer.from('hello'),
            undefined,
            () => []
        );

        // Check the encoded result synchronously
        const initialEncodedState = body.encodingPromise;

        await delay(0); // Let the encoding promise resolve but little more

        expect(body.encodingPromise).to.equal(initialEncodedState);

        expect(body.encodingPromise.state).to.equal('fulfilled');
        const encodedBody = body.encodingPromise.value as Buffer;
        expect(encodedBody.toString('utf8')).to.equal('hello')
    });

    it("should expose a pre-encoded encoding result immediately, and not re-encode later", async () => {
        const body = new EditableBody(
            Buffer.from('hello'),
            Buffer.from('hi'),
            () => [['content-encoding', 'gzip']],
            { throttleDuration: 0 }
        );

        const initialEncodedState = body.encodingPromise;

        await delay(10); // Wait, in case some other encoding kicks in

        expect(body.encodingPromise).to.equal(initialEncodedState);
        expect(body.latestEncodedLength).to.equal(2);

        expect(body.encodingPromise.state).to.equal('fulfilled');
        const encodedBody = body.encodingPromise.value as Buffer;
        expect(encodedBody.toString('utf8')).to.equal('hi')
    });

    it("should automatically encode initial data in the given encoding, if no pre-encoded data exists", async () => {
        const body = new EditableBody(
            Buffer.from('hello'),
            undefined,
            () => [['content-encoding', 'gzip']]
        );

        expect(body.latestEncodedLength).to.equal(undefined);

        const encodedBody = await body.encodingPromise;
        expect(zlib.gunzipSync(encodedBody).toString('utf8')).to.equal('hello');
        expect(body.latestEncodedLength).to.equal(encodedBody.length);
    });

    it("should update the encoded body when the decoded body is updated", async () => {
        const body = new EditableBody(
            Buffer.from('hello'),
            undefined,
            () => [],
            { throttleDuration: 0 }
        );

        await delay(0);
        body.updateDecodedBody(Buffer.from('updated'));

        const encodedBody = await body.encodingPromise;
        expect((await encodedBody).toString('utf8')).to.equal('updated')
    });

    it("should update the encoded body when the decoded body is updated", async () => {
        const body = new EditableBody(
            Buffer.from('hello'),
            undefined,
            () => [],
            { throttleDuration: 0 }
        );

        await delay(0);
        body.updateDecodedBody(Buffer.from('updated'));

        const encodedBody = await body.encodingPromise;
        expect(encodedBody.toString('utf8')).to.equal('updated');
    });

    it("should still expose the previous length during encoding", async () => {
        const body = new EditableBody(
            Buffer.from('hello'),
            undefined,
            () => [],
            { throttleDuration: 0 }
        );

        expect(body.latestEncodedLength).to.equal(undefined); // Initial pre-encoding value
        await delay(0);
        expect(body.latestEncodedLength).to.equal(5); // Initial encoded value

        body.updateDecodedBody(Buffer.from('updated'));
        expect(body.latestEncodedLength).to.equal(5); // Still shows old value during encoding

        await body.encodingPromise;
        expect(body.latestEncodedLength).to.equal(7); // Correct new value after encoding
    });

    it("should throw encoding errors by default if encoding fails", async () => {
        const body = new EditableBody(
            Buffer.from('hello'),
            undefined,
            () => [['content-encoding', 'invalid-unknown-encoding']], // <-- this will fail
            { throttleDuration: 0 }
        );

        try {
            const result = await body.encodingPromise;
            expect.fail(`Encoding should have thrown an error but returned ${result}`);
        } catch (e: any) {
            expect(e.message).to.equal('Unsupported encoding: invalid-unknown-encoding');
        }
    });

    it("should still expose the previous errors during encoding", async () => {
        let headers = observable.box([['content-encoding', 'invalid-unknown-encoding']] as Array<[string, string]>);
        const body = new EditableBody(
            Buffer.from('hello'),
            undefined,
            () => headers.get(), // <-- these headesr will fail to encode initially
            { throttleDuration: 0 }
        );

        expect(body.latestEncodingResult).to.deep.equal({ state: 'pending' }); // Initial pre-encoding value
        await delay(0);

        // Initial failure:
        const secondResult = body.latestEncodingResult;
        expect(secondResult.state).to.equal('rejected');
        expect((secondResult.value as any).message).to.equal('Unsupported encoding: invalid-unknown-encoding');

        headers.set([]);
        body.updateDecodedBody(Buffer.from('updated'));

        expect(body.latestEncodingResult).to.deep.equal(secondResult); // Still shows initial failure during encoding

        await body.encodingPromise;
        expect(body.latestEncodingResult).to.deep.equal({ state: 'fulfilled', value: Buffer.from('updated') }); // Correct new value after encoding
    });

    it("should return the decoded raw body as a best effort if encoding fails", async () => {
        const body = new EditableBody(
            Buffer.from('hello'),
            undefined,
            () => [['content-encoding', 'invalid-unknown-encoding']], // <-- this will fail
            { throttleDuration: 0 }
        );

        const encodedBody = await body.encodingBestEffortPromise;
        expect(encodedBody.toString('utf8')).to.equal('hello');
    });

    it("should update the encoding promise synchronously after updates, even if throttled", async () => {
        const body = new EditableBody(
            Buffer.from('hello'),
            undefined,
            () => [],
            { throttleDuration: 10 } // <-- Throttling explicitly enabled
        );

        body.updateDecodedBody(Buffer.from('first update'));
        await delay(1);
        body.updateDecodedBody(Buffer.from('second update'));
        await delay(1);
        body.updateDecodedBody(Buffer.from('third update'));

        const updatedEncodedState = body.encodingPromise;
        expect((await updatedEncodedState).toString('utf8')).to.equal('third update')
    });

});