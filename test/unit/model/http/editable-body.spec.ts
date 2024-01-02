import * as zlib from 'zlib';

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
        const initialEncodedState = body.encoded;

        await delay(0); // Let the encoding promise resolve but little more

        expect(body.encoded).to.equal(initialEncodedState);

        expect(body.encoded.state).to.equal('fulfilled');
        const encodedBody = body.encoded.value as Buffer;
        expect(encodedBody.toString('utf8')).to.equal('hello')
    });

    it("should expose a pre-encoded encoding result immediately, and not re-encode later", async () => {
        const body = new EditableBody(
            Buffer.from('hello'),
            Buffer.from('hi'),
            () => [['content-encoding', 'gzip']],
            { throttleDuration: 0 }
        );

        const initialEncodedState = body.encoded;

        await delay(10); // Wait, in case some other encoding kicks in

        expect(body.encoded).to.equal(initialEncodedState);
        expect(body.latestEncodedLength).to.equal(2);

        expect(body.encoded.state).to.equal('fulfilled');
        const encodedBody = body.encoded.value as Buffer;
        expect(encodedBody.toString('utf8')).to.equal('hi')
    });

    it("should automatically encode initial data in the given encoding, if no pre-encoded data exists", async () => {
        const body = new EditableBody(
            Buffer.from('hello'),
            undefined,
            () => [['content-encoding', 'gzip']]
        );

        expect(body.latestEncodedLength).to.equal(undefined);

        const encodedBody = await body.encoded;
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

        const encodedBody = await body.encoded;
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

        const encodedBody = await body.encoded;
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

        await body.encoded;
        expect(body.latestEncodedLength).to.equal(7); // Correct new value after encoding
    });

    it("should return the decoded raw body if encoding fails", async () => {
        const body = new EditableBody(
            Buffer.from('hello'),
            undefined,
            () => [['content-encoding', 'invalid-unknown-encoding']], // <-- this will fail
            { throttleDuration: 0 }
        );

        const encodedBody = await body.encoded;
        expect(encodedBody.toString('utf8')).to.equal('hello');
    });


});