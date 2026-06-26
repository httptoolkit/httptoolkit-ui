import { matchers } from 'mockttp';

import { expect } from '../../test-setup';

import {
    serializeRules,
    deserializeRules
} from '../../../src/model/rules/rule-serialization';

const requestWithHeaders = (headers: { [key: string]: string | string[] }) =>
    ({ headers }) as any;

describe("Header value includes matcher", () => {

    it("matches a substring within a header value", () => {
        const matcher = new matchers.HeaderValueIncludesMatcher({
            'Cookie': 'iamSessionIdExpiryDateInUtc'
        });

        expect(matcher.matches(requestWithHeaders({
            'cookie': 'a=1; iamSessionIdExpiryDateInUtc=2026-06-12T00:00:00Z; b=2'
        }))).to.equal(true);
    });

    it("does not match if the header value doesn't contain the text", () => {
        const matcher = new matchers.HeaderValueIncludesMatcher({
            'Cookie': 'iamSessionIdExpiryDateInUtc'
        });

        expect(matcher.matches(requestWithHeaders({
            'cookie': 'a=1; b=2'
        }))).to.equal(false);
    });

    it("does not match if the header isn't present at all", () => {
        const matcher = new matchers.HeaderValueIncludesMatcher({
            'Cookie': 'iamSessionIdExpiryDateInUtc'
        });

        expect(matcher.matches(requestWithHeaders({
            'host': 'example.com'
        }))).to.equal(false);
    });

    it("matches multi-value headers if any value contains the text", () => {
        const matcher = new matchers.HeaderValueIncludesMatcher({
            'Set-Cookie': 'session'
        });

        expect(matcher.matches(requestWithHeaders({
            'set-cookie': ['other=1', 'session=abc']
        }))).to.equal(true);
    });

    it("requires all given headers to match", () => {
        const matcher = new matchers.HeaderValueIncludesMatcher({
            'Cookie': 'mySession',
            'User-Agent': 'Chrome'
        });

        expect(matcher.matches(requestWithHeaders({
            'cookie': 'mySession=123',
            'user-agent': 'Mozilla/5.0 Chrome/120.0'
        }))).to.equal(true);

        expect(matcher.matches(requestWithHeaders({
            'cookie': 'mySession=123',
            'user-agent': 'Mozilla/5.0 Firefox/120.0'
        }))).to.equal(false);
    });

    it("survives a rule serialization round-trip", () => {
        const rules = {
            id: 'root',
            title: "Rules",
            isRoot: true,
            items: [{
                id: 'rule-1',
                type: 'http',
                activated: true,
                matchers: [
                    new matchers.HeaderValueIncludesMatcher({ 'Cookie': 'mySession' })
                ],
                steps: [{ type: 'simple', status: 200, data: 'mock response' }]
            }]
        } as any;

        const restoredRules = deserializeRules(
            JSON.parse(JSON.stringify(serializeRules(rules))),
            { rulesStore: {} as any }
        );

        const restoredMatcher = (restoredRules.items[0] as any).matchers[0];

        expect(restoredMatcher).to.be.instanceOf(matchers.HeaderValueIncludesMatcher);
        expect(restoredMatcher.headers).to.deep.equal({ 'cookie': 'mySession' });
        expect(restoredMatcher.matches(requestWithHeaders({
            'cookie': 'mySession=123'
        }))).to.equal(true);
        expect(restoredMatcher.explain()).to.equal(
            `with header values including {"cookie":"mySession"}`
        );
    });

});
