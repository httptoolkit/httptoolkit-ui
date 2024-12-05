import { expect } from 'chai';

import {
    parseCookieHeader,
    parseSetCookieHeader
} from '../../../../src/model/http/cookies';

describe('Cookie parsing', () => {
    describe('parseCookieHeader', () => {
        it('should parse a simple cookie', () => {
            const result = parseCookieHeader('name=value');
            expect(result).to.deep.equal([{ name: 'name', value: 'value' }]);
        });

        it('should parse multiple cookies', () => {
            const result = parseCookieHeader('name1=value1; name2=value2');
            expect(result).to.deep.equal([
                { name: 'name1', value: 'value1' },
                { name: 'name2', value: 'value2' }
            ]);
        });

        it('should handle URL encoded values', () => {
            const result = parseCookieHeader('name=hello%20world');
            expect(result).to.deep.equal([{ name: 'name', value: 'hello world' }]);
        });

        it('should return empty array for invalid input', () => {
            expect(parseCookieHeader('')).to.deep.equal([]);
            expect(parseCookieHeader('invalid')).to.deep.equal([]);
        });
    });

    describe('parseSetCookieHeader', () => {
        it('should parse a simple Set-Cookie header', () => {
            const result = parseSetCookieHeader('name=value');
            expect(result).to.deep.equal([{ name: 'name', value: 'value' }]);
        });

        it('should parse Set-Cookie with attributes', () => {
            const result = parseSetCookieHeader(
                'name=value; Path=/; Domain=example.com; Expires=Wed, 21 Oct 2015 07:28:00 GMT'
            );
            expect(result).to.deep.equal([{
                name: 'name',
                value: 'value',
                path: '/',
                domain: 'example.com',
                expires: 'Wed, 21 Oct 2015 07:28:00 GMT'
            }]);
        });

        it('should parse boolean flags', () => {
            const result = parseSetCookieHeader('name=value; httponly; Secure');
            expect(result).to.deep.equal([{
                name: 'name',
                value: 'value',
                httponly: true,
                secure: true
            }]);
        });

        it('should parse multiple Set-Cookie headers', () => {
            const result = parseSetCookieHeader([
                'name1=value1; Path=/',
                'name2=value2;httponly;UnknownOther=hello'
            ]);
            expect(result).to.deep.equal([
                { name: 'name1', value: 'value1', path: '/' },
                { name: 'name2', value: 'value2', httponly: true, unknownother: 'hello' }
            ]);
        });

        it('should handle case-insensitive attribute names', () => {
            const result = parseSetCookieHeader([
                'name=value; PATH=/test; httponly; DOMAIN=example.com; SecURE',
                'other=value; samesite=Strict; MAX-AGE=3600'
            ]);

            expect(result).to.deep.equal([{
                name: 'name',
                value: 'value',
                path: '/test',      // Standardized casing
                httponly: true,     // Standardized casing
                domain: 'example.com',
                secure: true
            }, {
                name: 'other',
                value: 'value',
                samesite: 'Strict',
                'max-age': '3600'
            }]);
        });

        it('should handle empty/invalid headers', () => {
            expect(parseSetCookieHeader('')).to.deep.equal([]);
            expect(parseSetCookieHeader([])).to.deep.equal([]);
            expect(parseSetCookieHeader([';', 'invalid'])).to.deep.equal([]);
        });
    });
});