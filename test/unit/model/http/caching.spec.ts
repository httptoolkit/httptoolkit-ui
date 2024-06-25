import * as dedent from "dedent";

import { expect } from "../../../test-setup";
import { getExchangeData, httpDate } from '../../unit-test-helpers';

import { explainCacheability, explainValidCacheTypes, explainCacheMatching, explainCacheLifetime } from "../../../../src/model/http/caching";

describe('Caching explanations', () => {
    describe('given a GET 200 with no explicit headers', () => {
        const exchange = getExchangeData();

        it("should say that it's probably not cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(false);
            expect(result!.summary).to.equal(
                'Typically not cacheable'
            );
        });

        it("should explain why it's probably not cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.type).to.equal('warning');
            expect(result!.explanation).to.include('200 responses are cacheable by default');
            expect(result!.explanation.replace('\n', ' ')).to.include(
                'most caches will not store a response like this'
            );
        });
    });

    describe('given a GET 200 with an explicit max-age and etag', () => {
        const exchange = getExchangeData({
            responseHeaders: {
                'date': httpDate(new Date()),
                'etag': 'tagtagtag',
                'cache-control': 'max-age=60'
            }
        });

        it("should say that it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Cacheable'
            );
        });

        it("should not include any suggestions", () => {
            const result = explainCacheability(exchange);
            expect(result!.type).to.equal(undefined);
            expect(result!.explanation).not.to.include('validation');
        });

        it("should say it's cacheable by private & shared caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'both private and shared caches'
            );
        });

        it("should say when it will require revalidation", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.summary).to.equal('Expires after 1 minute');
            expect(result!.explanation).to.include('max-age');
        });

    });

    describe('given a GET 200 with an explicit max-age and no etag', () => {
        const exchange = getExchangeData({
            responseHeaders: {
                'date': httpDate(new Date()),
                'cache-control': 'max-age=60'
            },
            responseBody: 'a body'
        });

        it("should say that it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Cacheable'
            );
        });

        it("should explain why it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include('max-age');
        });

        it("should suggest adding validation headers", () => {
            const result = explainCacheability(exchange);
            expect(result!.type).to.equal('suggestion');
            expect(result!.explanation).to.include('ETag');
        });

        it("should say it's cacheable by private & shared caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'both private and shared caches'
            );
        });
    });

    describe('given a GET 200 with a max-age of one year', () => {
        const exchange = getExchangeData({
            responseHeaders: {
                'date': httpDate(new Date()),
                'etag': 'fedcba',
                'cache-control': 'max-age=31536000'
            }
        });

        it("should say that it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Cacheable'
            );
        });

        it("should explain why it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include('max-age');
        });

        it("should say it's cacheable by private & shared caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'both private and shared caches'
            );
        });

        it("should say it will require revalidation in one year", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.summary).to.equal('Expires after 1 year');
            expect(result!.explanation).to.include('max-age');
        });

        it("should suggest adding an immutable directive", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.explanation).to.include('immutable');
            expect(result!.type).to.equal('suggestion');
        });
    });

    describe('given a GET 200 with a max-age of 0', () => {
        const exchange = getExchangeData({
            responseHeaders: {
                'date': httpDate(new Date()),
                'etag': 'fedcba',
                'cache-control': 'max-age=0'
            }
        });

        it("should say that it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Cacheable'
            );
        });

        it("should explain why it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include('max-age');
        });

        it("should say it's cacheable by private & shared caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'both private and shared caches'
            );
        });

        it("should say it requires immediate revalidation", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.summary).to.equal('Expires immediately');
            expect(result!.explanation).to.include('max-age');
        });
    });


    describe('given a GET 200 with an explicit max-age but no Date header', () => {
        const exchange = getExchangeData({
            responseHeaders: {
                'cache-control': 'max-age=60'
            }
        });

        it("should say that it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Cacheable'
            );
        });

        it("should explain why it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include('max-age');
        });

        it("should strongly suggest including a Date header", () => {
            const result = explainCacheability(exchange);
            expect(result!.type).to.equal('warning');
            expect(result!.explanation).to.include('Date');
        });

        it("should say it's cacheable by private & shared caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'both private and shared caches'
            );
        });
    });

    describe('given a GET 200 with an Expires header', () => {
        const exchange = getExchangeData({
            responseHeaders: {
                'expires': 'Thu, 1 Jan 2099 00:00:00 GMT'
            }
        });

        it("should say that it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Cacheable'
            );
        });

        it("should explain why it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include('Expires');
        });

        it("should suggest using max-age instead", () => {
            const result = explainCacheability(exchange);
            expect(result!.type).to.equal('suggestion');
            expect(result!.explanation).to.include('max-age');
        });

        it("should say it's cacheable by private & shared caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'both private and shared caches'
            );
        });

        it("should say it will require revalidation in many years", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.summary).to.match(/^Expires after \d\d years$/);
            expect(result!.explanation).to.include('Expires header');
        });
    });

    describe('given a GET 500 with max-age and s-maxage', () => {
        const exchange = getExchangeData({
            statusCode: 500,
            responseHeaders: {
                'cache-control': 'max-age=60, s-maxage=30'
            }
        });

        it("should say that it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Cacheable'
            );
        });

        it("should explain why it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include('max-age');
        });

        it("should say it's cacheable by all caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'both private and shared caches'
            );
        });

        it("should say when it will require revalidation", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.summary).to.equal(
                'Expires after 1 minute (30 seconds for shared caches)'
            );
            expect(result!.explanation).to.include('shared caches');
        });
    });

    describe('given a GET 500 with only a s-maxage', () => {
        const exchange = getExchangeData({
            statusCode: 500,
            responseHeaders: {
                'cache-control': 's-maxage=60'
            }
        });

        it("should say that it's not cacheable by clients", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Not cacheable by private (HTTP client) caches'
            );
        });

        it("should explain why it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include('s-maxage');
        });

        it("should say it's only cacheable by shared caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'May only be cached in shared'
            );
        });

        it("should say when it will require revalidation", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.summary).to.equal(dedent`
                Expires unpredictably for private caches, or
                after 1 minute for shared caches
            `.replace(/\n/g, ' '));
            expect(result!.explanation).to.include('s-maxage');
        });
    });

    describe('given a GET 200 with conflicting max age & Expires', () => {
        const exchange = getExchangeData({
            responseHeaders: {
                'cache-control': 'max-age=60',
                'expires': 'Thu, 01 Jan 2099 00:00:00 GMT'
            }
        });

        it("should say that it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Cacheable'
            );
        });

        it("should explain why it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include('max-age');
        });

        it("should warn about the conflict", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include('max-age');
        });

        it("should say it's cacheable by private & shared caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'both private and shared caches'
            );
        });

        it("should say when it requires revalidation after <max-age> seconds", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.summary).to.equal('Expires after 1 minute');
            expect(result!.explanation).to.include('max-age');
        });
    });

    describe('given a GET 200 with an explicit max-age and a private flag', () => {
        const exchange = getExchangeData({
            responseHeaders: {
                'date': httpDate(new Date()),
                'cache-control': 'max-age=60, private'
            }
        });

        it("should say that it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Cacheable'
            );
        });

        it("should explain why it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include('max-age');
        });

        it("should say it's cacheable only by private caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'only be cached in private caches'
            );
        });
    });

    describe('given a GET 200 with an authorization header', () => {
        const exchange = getExchangeData({
            requestHeaders: {
                authorization: 'bearer abcdabcd'
            },
            responseHeaders: {
                etag: '12341234'
            }
        });

        it("should say that it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Probably cacheable'
            );
        });

        it("should explain why it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include('200');
        });

        it("should say it's cacheable only by private caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'only be cached in private caches'
            );
        });
    });

    describe('given a GET 200 with an authorization header but required validation', () => {
        const exchange = getExchangeData({
            requestHeaders: {
                authorization: 'bearer abcdabcd'
            },
            responseHeaders: {
                etag: '12341234',
                'cache-control': 'no-cache, must-revalidate'
            }
        });

        it("should say that it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Cacheable'
            );
        });

        it("should explain why it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include('200');
        });

        it("should say it's cacheable by private & shared caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'both private and shared caches'
            );
        });

        it("should say it always requires revalidation", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.summary).to.equal("Must be revalidated every time it's used");
            expect(result!.explanation).to.include('no-cache');
        });
    });

    describe('given a 401 GET with an explicit public directive and ETag', () => {
        const exchange = getExchangeData({
            statusCode: 401,
            responseHeaders: {
                'cache-control': 'public',
                'etag': 'abcdef'
            }
        });

        it("should say that it's probably cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Probably cacheable'
            );
        });

        it("should suggest more explicit cache headers", () => {
            const result = explainCacheability(exchange);
            expect(result!.type).to.equal('warning');
            expect(result!.explanation).to.include('`public` Cache-Control directive');
            expect(result!.explanation.replace('\n', ' ')).to.include(
                'expiry behaviour is not well defined'
            );
        });

        it("should say it's cacheable by private & shared caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'both private and shared caches'
            );
        });
    });

    describe('given a 200 GET with a Last-Modified header', () => {
        const exchange = getExchangeData({
            responseHeaders: {
                'last-modified': 'Fri, 22 Mar 2019 11:54:00 GMT'
            }
        });

        it("should say that it's probably cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Probably cacheable'
            );
        });

        it("should suggest more explicit cache headers", () => {
            const result = explainCacheability(exchange);
            expect(result!.type).to.equal('warning');
            expect(result!.explanation).to.include('200 responses are cacheable by default');
            expect(result!.explanation.replace('\n', ' ')).to.include(
                'expiry behaviour is not well defined'
            );
        });

        it("should say it's cacheable by private & shared caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'both private and shared caches'
            );
        });

        it("should say when it expires unpredictably", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.summary).to.equal('Expires unpredictably');
            expect(result!.explanation).to.include('Last-Modified');
        });
    });

    describe('given a 200 GET with a Last-Modified header and no-cache', () => {
        const exchange = getExchangeData({
            responseHeaders: {
                'last-modified': 'Fri, 22 Mar 2019 11:54:00 GMT',
                'cache-control': 'no-cache'
            }
        });

        it("should say that it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Cacheable'
            );
        });

        it("should explain why it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.type).to.equal(undefined);
            expect(result!.explanation).to.include('200 responses are cacheable by default');
            expect(result!.explanation).to.include('no-cache');
        });

        it("should say it's cacheable by private & shared caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'both private and shared caches'
            );
        });

        it("should say it will require revalidation at all times", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.summary).to.equal("Must be revalidated every time it's used");
            expect(result!.explanation).to.include('no-cache');
        });
    });

    describe('given a GET 500 error with no explicit headers', () => {
        const exchange = getExchangeData({
            statusCode: 500
        });

        it("should say that it's not cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(false);
            expect(result!.summary).to.equal('Not cacheable');
        });

        it("should explain why it's not cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include('500');
        });
    });

    describe('given a GET 200 with a no-store response directive', () => {
        const exchange = getExchangeData({
            responseHeaders: {
                'cache-control': 'no-store'
            }
        });

        it("should say that it's not cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(false);
            expect(result!.summary).to.equal(
                'Not cacheable'
            );
        });

        it("should explain why it's not cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include('no-store');
        });
    });

    describe('given a GET 200 with a no-store pragma directive', () => {
        const exchange = getExchangeData({
            responseHeaders: {
                'pragma': 'no-store'
            }
        });

        it("should say that it's not cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(false);
            expect(result!.summary).to.equal(
                'Not cacheable'
            );
        });

        it("should explain why it's not cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include('no-store');
        });

        it("should suggest moving to cache-control", () => {
            const result = explainCacheability(exchange);
            expect(result!.type).to.equal('suggestion');
            expect(result!.explanation).to.include('Pragma');
        });
    });

    describe('given a POST with no explicit headers', () => {
        const exchange = getExchangeData({
            method: 'POST'
        });

        it("should say that it's not cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(false);
            expect(result!.summary).to.equal(
                'Not cacheable'
            );
        });

        it("should explain why it's not cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include(
                'POST responses are not typically cacheable'
            );
            expect(result!.explanation).to.include(
                'This response does not fulfill those conditions'
            );
        });
    });

    describe('given a POST with proper caching headers', () => {
        const exchange = getExchangeData({
            method: 'POST',
            path: '/abc',
            query: '?a=b',
            responseHeaders: {
                'cache-control': 'public, max-age=10000',
                'content-location': '/abc?a=b'
            }
        });

        it("should say that it's possibly cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'May be cacheable for future GET/HEAD requests'
            );
        });

        it("should explain why it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include(
                'POST responses are not typically cacheable'
            );
            expect(result!.explanation).to.include(
                'This response fulfills those conditions'
            );
        });

        it("should say it's cacheable by private & shared caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'both private and shared caches'
            );
        });

        it("should summarize the resulting cache matching", () => {
            const result = explainCacheMatching(exchange);
            expect(result!.summary).to.equal(
                'Will match future GET & HEAD requests to this URL'
            );
        });

        it("should explain the result matching explicitly", () => {
            const result = explainCacheMatching(exchange);
            expect(result!.explanation.replace(/\n/g, ' ')).to.include(dedent`
                may be used for future safe requests for the resource
                updated by this POST, regardless of header values
            `.replace(/\n/g, ' '));
        });

        it("should explain when it will require revalidation", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.summary).to.equal('Expires after 2 hours');
            expect(result!.explanation).to.include('max-age');
        });
    });

    describe('given a DELETE with no explicit headers', () => {
        const exchange = getExchangeData({
            method: 'DELETE'
        });

        it("should say that it's not cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(false);
            expect(result!.summary).to.equal(
                'Not cacheable'
            );
        });

        it("should explain why it's not cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include(
                'DELETE requests are never cacheable'
            );
        });
    });

    describe('given an OPTIONS CORS response with no explicit headers', () => {
        const exchange = getExchangeData({
            method: 'OPTIONS',
            requestHeaders: {
                origin: 'http://example2.com'
            }
        });

        it("should say that it's only briefly cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Very briefly cacheable'
            );
        });

        it("should explain why it's only briefly cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation.replace('\n', ' ')).to.include(dedent`
                OPTIONS preflight requests are not cacheable, unless an
                Access-Control-Max-Age header is provided
            `.replace('\n', ' '));
        });

        it("should explain that it's only briefly cacheable", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.summary).to.equal('Expires unpredictably, around 5 seconds');
        });
    });

    describe('given an OPTIONS CORS response with Access-Control-Max-Age', () => {
        const exchange = getExchangeData({
            method: 'OPTIONS',
            requestHeaders: {
                origin: 'http://example2.com'
            },
            responseHeaders: {
                'access-control-max-age': '600',
                'access-control-allow-methods': 'GET, POST, DELETE',
                'access-control-allow-headers': 'x-header',
            }
        });

        it("should say that it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Cacheable'
            );
        });

        it("should explain why it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation.replace(/\n/g, ' ')).to.include(
                'will be cached if a Access-Control-Max-Age header is provided, as here'
            );
        });

        it("should say it's cacheable by private caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'only be cached in private caches'
            );
        });

        it("should summarize the CORS cache matching", () => {
            const result = explainCacheMatching(exchange);
            expect(result!.summary).to.equal(
                'Will match corresponding future CORS requests for this URL'
            );
        });

        it("should explain the detailed CORS matching behaviour", () => {
            const result = explainCacheMatching(exchange);
            expect(result!.explanation).to.include('The origin is <code>http://example2\\.com</code>');
            expect(result!.explanation).to.include(
                'The request method would be GET, HEAD, POST or DELETE'
            );
            expect(result!.explanation).to.include('X\\-Header');
        });

        it("should say when it expires", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.summary).to.equal("Expires after 10 minutes");
            expect(result!.explanation).to.include('Access-Control-Max-Age');
        });
    });

    describe('given an OPTIONS CORS response with 0 Access-Control-Max-Age', () => {
        const exchange = getExchangeData({
            method: 'OPTIONS',
            requestHeaders: {
                origin: 'http://example2.com'
            },
            responseHeaders: {
                'access-control-max-age': '0'
            }
        });

        it("should say that it's only briefly cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(false);
            expect(result!.summary).to.equal(
                'Not cacheable'
            );
        });

        it("should explain why it's not cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation.replace('\n', ' ')).to.include(dedent`
                that header is set to 0
            `.replace('\n', ' '));
        });
    });

    describe('given a permanent redirect with no explicit headers', () => {
        const exchange = getExchangeData({
            statusCode: 301
        });

        it("should say it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal('Cacheable');
        });

        it("should explain why it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include(
                '301 responses are cacheable by default'
            );
            expect(result!.explanation.replace(/\n/g, ' ')).to.include(
                'clients will cache it forever'
            );
        });

        it("should say it's cacheable by private & shared caches", () => {
            const validCacheTypes = explainValidCacheTypes(exchange);
            expect(validCacheTypes!.summary).to.include(
                'both private and shared caches'
            );
        });

        it("should say it will never expire", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.summary).to.equal("Never expires");
            expect(result!.explanation).to.include('301');
        });
    });

    describe('given a 200 GET with a max-age and Vary: *', () => {
        const exchange = getExchangeData({
            responseHeaders: {
                vary: '*',
                date: httpDate(new Date()),
                'cache-control': 'max-age=60'
            }
        });

        it("should say it's not cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(false);
            expect(result!.summary).to.equal('Not cacheable');
        });

        it("should explain why it's not cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.explanation).to.include('Vary');
        });
    });

    describe('given a 200 GET with an ETag and a Vary-ing header', () => {
        const exchange = getExchangeData({
            requestHeaders: {
                cookie: 'abc'
            },
            responseHeaders: {
                vary: 'Cookie',
                date: httpDate(new Date()),
                'cache-control': 'max-age=60'
            }
        });

        it("should say it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal('Cacheable');
        });

        it("should include the Vary in the cache key", () => {
            const result = explainCacheMatching(exchange);
            expect(result!.summary).to.include(
                'this URL that have the same \'Cookie\' header'
            );
        });

        it("should explain the Vary in the cache key", () => {
            const result = explainCacheMatching(exchange);
            expect(result!.explanation).to.include(
                'as long as those requests have a <code>Cookie</code> header set to <code>abc</code>'
            );
        });
    });

    describe('given a 200 GET with an ETag and multiple Vary-ing headers', () => {
        const exchange = getExchangeData({
            requestHeaders: {
                'accept-language': 'en',
                cookie: 'abc'
            },
            responseHeaders: {
                vary: 'Cookie, accept-Language, accept',
                date: httpDate(new Date()),
                'cache-control': 'max-age=60'
            }
        });

        it("should say it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal('Cacheable');
        });

        it("should include the Vary in the cache key", () => {
            const result = explainCacheMatching(exchange);
            expect(result!.summary).to.include(dedent`
                this URL that have the same 'Cookie', 'Accept-Language'
                and 'Accept' headers
            `.replace(/\n/g, ' '));
        });

        it("should explain the Vary in the cache key", () => {
            const result = explainCacheMatching(exchange);
            expect(result!.explanation).to.include(dedent`
                as long as those requests have a <code>Cookie</code> header set to <code>abc</code>,
                a <code>Accept\-Language</code> header set to <code>en</code> and no <code>Accept</code> header
            `.replace(/\n/g, ' '));
        });
    });

    describe('given a GET 200 with a max-age and stale-while-revalidate', () => {
        const exchange = getExchangeData({
            responseHeaders: {
                'date': httpDate(new Date()),
                'etag': 'fedcba',
                'cache-control': 'max-age=600, stale-while-revalidate=60'
            }
        });

        it("should say that it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Cacheable'
            );
        });

        it("should explain stale behaviour", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.summary).to.equal(dedent`
                Expires after 10 minutes, then can be served stale
                whilst revalidating for 1 minute
            `.replace(/\n/g, ' '));
            expect(result!.explanation).to.include('max-age');
            expect(result!.explanation).to.include('max-age');
        });
    });

    describe('given a GET 200 with a max-age and stale-if-error', () => {
        const exchange = getExchangeData({
            responseHeaders: {
                'date': httpDate(new Date()),
                'etag': 'fedcba',
                'cache-control': 'max-age=600, stale-if-error=60'
            }
        });

        it("should say that it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Cacheable'
            );
        });

        it("should explain stale behaviour", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.summary).to.equal(dedent`
                Expires after 10 minutes, then can be served stale
                if errors are received for 1 minute
            `.replace(/\n/g, ' '));
            expect(result!.explanation).to.include('max-age');
        });
    });

    describe('given a GET 200 with a max-age and stale-<while/if>-<revalidate/error>', () => {
        const exchange = getExchangeData({
            responseHeaders: {
                'date': httpDate(new Date()),
                'etag': 'fedcba',
                'cache-control':
                    'max-age=600, stale-if-error=60, stale-while-revalidate=120'
            }
        });

        it("should say that it's cacheable", () => {
            const result = explainCacheability(exchange);
            expect(result!.cacheable).to.equal(true);
            expect(result!.summary).to.equal(
                'Cacheable'
            );
        });

        it("should explain stale behaviour", () => {
            const result = explainCacheLifetime(exchange);
            expect(result!.summary).to.equal(dedent`
                Expires after 10 minutes, then can be served stale temporarily
                whilst revalidating or if receiving errors
            `.replace(/\n/g, ' '));
            expect(result!.explanation).to.include('max-age');
            expect(result!.explanation.replace(/\n/g, ' ')).to.include(
                'can still be served in the meantime, for 2 minutes extra'
            );
            expect(result!.explanation.replace(/\n/g, ' ')).to.include(dedent`
                can still be served in the meantime if any errors are
                encountered, for 1 minute after the response expires
            `.replace(/\n/g, ' '));
        });
    });
});