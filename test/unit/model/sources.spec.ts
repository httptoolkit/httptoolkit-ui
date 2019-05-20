import { expect } from '../../test-setup';

import { Icons } from '../../../src/icons';

import { parseSource } from '../../../src/model/sources';

const LINUX_CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36';
const LINUX_FIREFOX = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:64.0) Gecko/20100101 Firefox/64.0';
const OSX_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0.1 Safari/605.1.15';
const WINDOWS_IE = 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1; .NET CLR 1.1.4322)';
const WINDOWS_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36';

const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 4.2.1; en-us; Nexus 5 Build/JOP40D) AppleWebKit/535.19 (KHTML, like Gecko; googleweblight) Chrome/38.0.1025.166 Mobile Safari/535.19';
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15E148 Safari/604.1';

const LINUX_NPM = 'npm/6.4.1 node/v10.13.0 linux x64';
const GIT = 'git/2.20.1';
const GUZZLE_PHP = 'GuzzleHttp/6.3.3 curl/7.58.0 PHP/7.2.17-0ubuntu0.18.04.1';
const JAVA_APACHE = 'Apache-HttpClient/4.5.2 (Java/1.8.0_60)';
const WGET = 'Wget/1.12 (linux-gnu)';

describe('HTTP source parsing', () => {
    describe('source summaries', () => {
        describe('well-known UAs', () => {
            it('should parse modern Chrome UAs', () => {
                const source = parseSource(WINDOWS_CHROME);

                expect(source.summary).to.equal('Chrome 60 (Windows 10)');
                expect(source.icon).to.equal(Icons.Chrome);
            });

            it('should parse modern Firefox UAs', () => {
                const source = parseSource(LINUX_FIREFOX);

                expect(source.summary).to.equal('Firefox 64 (Ubuntu)');
                expect(source.icon).to.equal(Icons.Firefox);
            });

            it('should parse modern Safari UAs', () => {
                const source = parseSource(OSX_SAFARI);

                expect(source.summary).to.equal('Safari 12 (Mac OS 10.13)');
                expect(source.icon).to.equal(Icons.Safari);
            });

            it('should parse IE UAs', () => {
                const source = parseSource(WINDOWS_IE);

                expect(source.summary).to.equal('IE 6 (Windows XP)');
                expect(source.icon).to.equal(Icons.IE);
            });

            it('should parse Git UA', () => {
                const source = parseSource(GIT);

                expect(source.summary).to.equal('Git/2.20.1');
                expect(source.icon).to.equal(Icons.Git);
            });

            it('should parse NPM UA', () => {
                const source = parseSource(LINUX_NPM);

                expect(source.summary).to.equal('Npm/6.4.1 (Linux x64)');
                expect(source.icon).to.equal(Icons.Npm);
            });

            it('should parse a PHP-based UA', () => {
                const source = parseSource(GUZZLE_PHP);

                expect(source.summary).to.equal('GuzzleHttp/6.3.3 (Ubuntu 0.18)');
                expect(source.icon).to.equal(Icons.Php);
            });

        });

        describe('unknown UAs:', () => {
            it('should parse Java Apache HttpClient UAs', () => {
                const source = parseSource(JAVA_APACHE);

                expect(source.summary).to.equal('Apache-HttpClient/4.5.2');
                expect(source.icon).to.equal(Icons.Unknown);
            });

            it('should parse wget UAs', () => {
                const source = parseSource(WGET);

                expect(source.summary).to.equal('Wget/1.12 (Linux)');
                expect(source.icon).to.equal(Icons.Unknown);
            });

            it('should handle empty user agents', () => {
                const source = parseSource('');

                expect(source.summary).to.equal('Unknown client');
                expect(source.icon).to.equal(Icons.Unknown);
            });

            it('should handle undefined user agents', () => {
                const source = parseSource(undefined);

                expect(source.summary).to.equal('Unknown client');
                expect(source.icon).to.equal(Icons.Unknown);
            });
        });
    });

    describe('source descriptions', () => {
        it('should show detailed info for Chrome Linux clients', () => {
            const source = parseSource(LINUX_CHROME);

            expect(source.description).to.equal(
                'This request came from Chrome 70, which uses the ' +
                    'WebKit 537.36 engine. The device is running Linux x86_64, with ' +
                    'an amd64 CPU.'
            );
        });

        it('should show detailed info for Chrome Windows clients', () => {
            const source = parseSource(WINDOWS_CHROME);

            expect(source.description).to.equal(
                'This request came from Chrome 60, which uses the ' +
                    'WebKit 537.36 engine. The device is running Windows 10, with ' +
                    'an amd64 CPU.'
            );
        });

        it('should show detailed info for Firefox Linux clients', () => {
            const source = parseSource(LINUX_FIREFOX);

            expect(source.description).to.equal(
                'This request came from Firefox 64, which uses the ' +
                    'Gecko 64 engine. The device is running Ubuntu, with ' +
                    'an amd64 CPU.'
            );
        });

        it('should show detailed info for Chrome Android clients', () => {
            const source = parseSource(ANDROID_CHROME);

            expect(source.description).to.equal(
                'This request came from Chrome 38, which uses the ' +
                    'WebKit 535.19 engine. The device is a LG Nexus 5 mobile phone, ' +
                    'running Android 4.2.'
            );
        });

        it('should show detailed info for iPhone clients', () => {
            const source = parseSource(IPHONE_SAFARI);

            expect(source.description).to.equal(
                'This request came from Mobile Safari 11, which uses the ' +
                    'WebKit 605.1 engine. The device is an Apple iPhone mobile phone, ' +
                    'running iOS 11.4.'
            );
        });

        it('should show no detailed info for unknown clients', () => {
            const source = parseSource(GIT);

            expect(source.description).to.equal(undefined);
        });
    });
});