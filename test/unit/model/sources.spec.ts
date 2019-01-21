import { expect } from '../../test-setup';

import { Icons } from '../../../src/icons';

import { parseSource } from '../../../src/model/sources';

describe('HTTP source parsing', () => {
    describe('well-known UAs', () => {
        it('should parse modern Chrome UAs', () => {
            const source = parseSource(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36'
            );

            expect(source.description).to.equal('Chrome 60 (Windows 10)');
            expect(source.icon).to.equal(Icons.Chrome);
        });

        it('should parse modern Firefox UAs', () => {
            const source = parseSource(
                'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:64.0) Gecko/20100101 Firefox/64.0'
            );

            expect(source.description).to.equal('Firefox 64 (Ubuntu)');
            expect(source.icon).to.equal(Icons.Firefox);
        });

        it('should parse modern Safari UAs', () => {
            const source = parseSource(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0.1 Safari/605.1.15'
            );

            expect(source.description).to.equal('Safari 12 (Mac OS 10.13)');
            expect(source.icon).to.equal(Icons.Safari);
        });

        it('should parse IE UAs', () => {
            const source = parseSource(
                'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1; .NET CLR 1.1.4322)'
            );

            expect(source.description).to.equal('IE 6 (Windows XP)');
            expect(source.icon).to.equal(Icons.IE);
        });

        it('should parse Git UA', () => {
            const source = parseSource(
                'git/2.20.1'
            );

            expect(source.description).to.equal('Git/2.20.1');
            expect(source.icon).to.equal(Icons.Git);
        });

        it('should parse NPM UA', () => {
            const source = parseSource(
                'npm/6.4.1 node/v10.13.0 linux x64'
            );

            expect(source.description).to.equal('Npm/6.4.1 (Linux x64)');
            expect(source.icon).to.equal(Icons.Npm);
        });

    });

    describe('unknown UAs:', () => {
        it('should parse Java Apache HttpClient UAs', () => {
            const source = parseSource(
                'Apache-HttpClient/4.5.2 (Java/1.8.0_60)'
            );

            expect(source.description).to.equal('Apache-HttpClient/4.5.2');
            expect(source.icon).to.equal(Icons.Unknown);
        });

        it('should parse wget UAs', () => {
            const source = parseSource(
                'Wget/1.12 (linux-gnu)'
            );

            expect(source.description).to.equal('Wget/1.12 (Linux)');
            expect(source.icon).to.equal(Icons.Unknown);
        });

        it('should handle empty user agents', () => {
            const source = parseSource('');

            expect(source.description).to.equal('Unknown client');
            expect(source.icon).to.equal(Icons.Unknown);
        });

        it('should handle undefined user agents', () => {
            const source = parseSource(undefined);

            expect(source.description).to.equal('Unknown client');
            expect(source.icon).to.equal(Icons.Unknown);
        });
    });
});