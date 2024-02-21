import { observable } from 'mobx';

import { expect } from '../../../test-setup';

import { RawHeaders } from '../../../../src/types';

import {
    syncUrlToHeaders,
    syncBodyToContentLength
} from '../../../../src/model/http/editable-request-parts';
import { EditableBody } from '../../../../src/model/http/editable-body';

describe("Editable request header synchronization", () => {
    describe("for hostnames", () => {
        it("doesn't do anything immediately given an empty input", () => {
            const url = observable.box('');
            const headers: RawHeaders = observable([]);

            syncUrlToHeaders(
                () => url.get(),
                () => headers
            );

            expect(headers).to.deep.equal([]);
        });

        it("doesn't do anything immediately given a plain protocol", () => {
            const url = observable.box('');
            const headers: RawHeaders = observable([]);

            syncUrlToHeaders(
                () => url.get(),
                () => headers
            );

            url.set('https://');

            expect(headers).to.deep.equal([]);
        });

        it("initializes the host header when entering a first character of a URL", () => {
            const url = observable.box('');
            const headers: RawHeaders = observable([]);

            syncUrlToHeaders(
                () => url.get(),
                () => headers
            );

            url.set('https://');
            url.set('https://a');

            expect(headers).to.deep.equal([
                ['host', 'a']
            ]);
        });

        it("updates an entered matching URL and host header if the URL changes", () => {
            const url = observable.box('https://example.test:8080');
            const headers: RawHeaders = observable([
                ['host', 'example.test:8080']
            ]);

            syncUrlToHeaders(
                () => url.get(),
                () => headers
            );

            url.set('https://example2.test');

            expect(headers).to.deep.equal([
                ['host', 'example2.test']
            ]);
        });

        it("doesn't modify the host header if the URL changes but they didn't match initially", () => {
            const url = observable.box('https://example.test');
            const headers: RawHeaders = observable([
                ['host', 'other.test']
            ]);

            syncUrlToHeaders(
                () => url.get(),
                () => headers
            );

            url.set('https://example2.test');

            expect(headers).to.deep.equal([
                ['host', 'other.test']
            ]);
        });

        it("doesn't modify the host header or URL if the host header is modified manually", () => {
            const url = observable.box('https://example.test');
            const headers: RawHeaders = observable([
                ['host', 'example.test']
            ]);

            syncUrlToHeaders(
                () => url.get(),
                () => headers
            );

            headers[0][1] = 'other.test';

            expect(url.get()).to.equal('https://example.test');
        });
    });

    describe("for body framing synchronization", () => {

        const waitForBodyUpdates = async (body: EditableBody) => { await body.encodingPromise; }

        it("doesn't do anything immediately given an empty body", async () => {
            const headers: RawHeaders = observable([]);

            const body = new EditableBody(Buffer.from([]), undefined, () => headers);

            syncBodyToContentLength(
                body,
                () => headers
            );

            await waitForBodyUpdates(body);
            expect(headers).to.deep.equal([]);
        });

        it("doesn't do anything immediately given a populated body with no headers", async () => {
            const headers: RawHeaders = observable([]);

            const body = new EditableBody(Buffer.from('hello'), undefined, () => headers);

            syncBodyToContentLength(
                body,
                () => headers
            );

            await waitForBodyUpdates(body);
            expect(headers).to.deep.equal([]);
        });

        it("adds a content length when a body is added", async () => {
            const headers: RawHeaders = observable([]);

            const body = new EditableBody(Buffer.from([]), undefined, () => headers, { throttleDuration: 0 });

            syncBodyToContentLength(
                body,
                () => headers
            );
            await waitForBodyUpdates(body);

            body.updateDecodedBody(Buffer.from('hello'));

            await waitForBodyUpdates(body);
            expect(headers).to.deep.equal([
                ['content-length', '5']
            ]);
        });

        it("adds a content length when a body is added, even before initial encoding completes", async () => {
            const headers: RawHeaders = observable([
                ['content-encoding', 'gzip']
            ]);

            const body = new EditableBody(
                Buffer.from([]),
                undefined,
                () => headers,
                {
                    // We should see an encoding event synchronously at start, and then a
                    // second after throttling, 10ms later.
                    throttleDuration: 10
                }
            );

            syncBodyToContentLength(
                body,
                () => headers
            );

            // Add the content, without waiting for the initial encoding to complete:
            body.updateDecodedBody(Buffer.from('hello'));
            await waitForBodyUpdates(body);

            expect(headers).to.deep.equal([
                ['content-encoding', 'gzip'],
                ['content-length', '25']
            ]);
        });

        it("updates the content length with the body, if they were in sync", async () => {
            const headers: RawHeaders = observable([
                ['content-length', '5']
            ]);

            const body = new EditableBody(
                Buffer.from('hello'),
                Buffer.from('hello'),
                () => headers,
                { throttleDuration: 0 }
            );

            syncBodyToContentLength(
                body,
                () => headers
            );

            body.updateDecodedBody(Buffer.from('goodbye'));

            await waitForBodyUpdates(body);
            expect(headers).to.deep.equal([
                ['content-length', '7']
            ]);
        });

        it("updates the content length when an encoding is added, if it was in sync", async () => {
            const headers: RawHeaders = observable([
                ['content-length', '5']
            ]);

            const body = new EditableBody(
                Buffer.from('hello'),
                undefined,
                () => headers,
                { throttleDuration: 0 }
            );
            await waitForBodyUpdates(body);

            syncBodyToContentLength(
                body,
                () => headers
            );

            headers.push(['content-encoding', 'gzip']);

            await waitForBodyUpdates(body);
            expect(headers).to.deep.equal([
                ['content-length', '25'],
                ['content-encoding', 'gzip']
            ]);
        });

        it("updates the content length when an encoding is removed, if it was in sync", async () => {
            const headers: RawHeaders = observable([
                ['content-length', '25'],
                ['content-encoding', 'gzip']
            ]);

            const body = new EditableBody(
                Buffer.from('hello'),
                undefined,
                () => headers,
                { throttleDuration: 0 }
            );
            await waitForBodyUpdates(body);

            syncBodyToContentLength(
                body,
                () => headers
            );

            headers.splice(1, 1); // Remove the content-encoding header

            await waitForBodyUpdates(body);
            expect(headers).to.deep.equal([
                ['content-length', '5']
            ]);
        });

        it("does not add a content length if an already encoded body is provided", async () => {
            const headers: RawHeaders = observable([]);

            const body = new EditableBody(
                Buffer.from('hello'),
                Buffer.from('hi'),
                () => headers,
                { throttleDuration: 0 }
            );

            syncBodyToContentLength(
                body,
                () => headers
            );

            await waitForBodyUpdates(body);
            expect(headers).to.deep.equal([]);
        });

        it("updates a matching content-length when updating an already provided encoded body", async () => {
            const headers: RawHeaders = observable([
                ['content-length', '2']
            ]);

            const body = new EditableBody(
                Buffer.from('hello'),
                Buffer.from('hi'),
                () => headers,
                { throttleDuration: 0 }
            );

            syncBodyToContentLength(
                body,
                () => headers
            );

            await waitForBodyUpdates(body);

            body.updateDecodedBody(Buffer.from('hello world'));

            await waitForBodyUpdates(body);
            expect(headers).to.deep.equal([
                ['content-length', '11']
            ]);
        });
    });
});