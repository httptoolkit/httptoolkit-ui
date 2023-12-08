import { observable } from 'mobx';

import { expect } from '../../../test-setup';

import { RawHeaders } from '../../../../src/types';

import {
    syncUrlToHeaders
} from '../../../../src/model/http/editable-request-parts';

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
});