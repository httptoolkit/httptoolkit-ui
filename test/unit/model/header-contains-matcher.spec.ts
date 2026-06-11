import * as serializr from 'serializr';

import { expect } from '../../test-setup';

import { HeaderContainsMatcher } from '../../../src/model/rules/definitions/http-rule-definitions';

const requestWithHeaders = (headers: { [key: string]: string | string[] }) =>
    ({ headers }) as any;

describe("Header-contains matcher", () => {

    it("matches a substring within a single-value header", async () => {
        const matcher = new HeaderContainsMatcher('Cookie', 'iamSessionIdExpiryDateInUtc');

        expect(await matcher.callback(requestWithHeaders({
            'cookie': 'a=1; iamSessionIdExpiryDateInUtc=2026-06-12T00:00:00Z; b=2'
        }))).to.equal(true);
    });

    it("does not match if the header value doesn't contain the text", async () => {
        const matcher = new HeaderContainsMatcher('Cookie', 'iamSessionIdExpiryDateInUtc');

        expect(await matcher.callback(requestWithHeaders({
            'cookie': 'a=1; b=2'
        }))).to.equal(false);
    });

    it("does not match if the header isn't present at all", async () => {
        const matcher = new HeaderContainsMatcher('Cookie', 'iamSessionIdExpiryDateInUtc');

        expect(await matcher.callback(requestWithHeaders({
            'host': 'example.com'
        }))).to.equal(false);
    });

    it("matches header names case-insensitively", async () => {
        const matcher = new HeaderContainsMatcher('X-Custom-Header', 'value');

        // Mockttp always provides headers keyed lowercase:
        expect(await matcher.callback(requestWithHeaders({
            'x-custom-header': 'some-value-here'
        }))).to.equal(true);
    });

    it("matches multi-value headers if any value contains the text", async () => {
        const matcher = new HeaderContainsMatcher('Set-Cookie', 'session');

        expect(await matcher.callback(requestWithHeaders({
            'set-cookie': ['other=1', 'session=abc']
        }))).to.equal(true);
    });

    it("serializes and deserializes back to a working matcher", async () => {
        const matcher = new HeaderContainsMatcher('Cookie', 'mySession');

        const data = serializr.serialize(matcher);

        expect(data).to.deep.equal({
            uiType: 'header-contains',
            type: 'callback',
            headerName: 'Cookie',
            headerValue: 'mySession'
        });

        const restored = serializr.deserialize(HeaderContainsMatcher, data);

        expect(restored.headerName).to.equal('Cookie');
        expect(restored.headerValue).to.equal('mySession');
        expect(restored.explain()).to.equal(matcher.explain());

        expect(await restored.callback(requestWithHeaders({
            'cookie': 'mySession=123'
        }))).to.equal(true);
        expect(await restored.callback(requestWithHeaders({
            'cookie': 'other=123'
        }))).to.equal(false);
    });

});
