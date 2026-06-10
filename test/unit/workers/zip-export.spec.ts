import { expect } from '../../test-setup';
import { unzipSync, strFromU8 } from 'fflate';

import { exportAsZip } from '../../../src/services/ui-worker-api';

describe('ZIP export worker round-trip', function () {
    this.timeout(10000);

    const makeHar = (entryCount: number) => ({
        log: {
            version: '1.2',
            creator: { name: 'httptoolkit-ui', version: 'test' },
            entries: Array.from({ length: entryCount }).map((_, i) => ({
                startedDateTime: new Date().toISOString(),
                time: 0,
                request: {
                    method: 'GET',
                    url: `https://example.com/item/${i}`,
                    httpVersion: 'HTTP/1.1',
                    headers: [
                        { name: 'Host', value: 'example.com' },
                        { name: 'Content-Length', value: '0' },
                        { name: ':authority', value: 'example.com' }
                    ],
                    queryString: [],
                    cookies: [],
                    headersSize: -1,
                    bodySize: 0
                },
                response: {
                    status: 200,
                    statusText: 'OK',
                    httpVersion: 'HTTP/1.1',
                    headers: [],
                    cookies: [],
                    content: { size: 0, mimeType: 'text/plain' },
                    redirectURL: '',
                    headersSize: -1,
                    bodySize: 0
                },
                cache: {},
                timings: { send: 0, wait: 0, receive: 0 }
            })),
            _tlsErrors: []
        }
    }) as any;

    it('produces a valid ZIP with snippets, HAR and manifest', async () => {
        const res = await exportAsZip({
            har: makeHar(2),
            formatIds: ['shell~~curl'],
            includeHar: true,
            httpToolkitVersion: 'test'
        });

        expect(res.snippetErrorCount).to.equal(0);
        expect(res.snippetSuccessCount).to.equal(2);

        const unpacked = unzipSync(new Uint8Array(res.archive));
        const names = Object.keys(unpacked);
        expect(names).to.include('manifest.json');
        expect(names).to.include('requests.har');
        expect(names.filter(n => n.startsWith('shell-curl/') && !n.endsWith('/'))).to.have.length(2);

        const manifest = JSON.parse(strFromU8(unpacked['manifest.json']));
        expect(manifest.version).to.equal(1);
        expect(manifest.httpToolkitVersion).to.equal('test');
        expect(manifest.requestCount).to.equal(2);
        expect(manifest.formats).to.have.length(1);
        expect(manifest.formats[0].id).to.equal('shell~~curl');
        expect(manifest.formats[0].target).to.equal('shell');
        expect(manifest.formats[0].client).to.equal('curl');
        expect(manifest.formats[0].folderName).to.equal('shell-curl');
        expect(manifest.errors).to.have.length(0);
    });

    it('filters content-length / pseudo-headers before snippet generation', async () => {
        const res = await exportAsZip({
            har: makeHar(1),
            formatIds: ['shell~~curl'],
            includeHar: false,
            httpToolkitVersion: 'test'
        });
        const unpacked = unzipSync(new Uint8Array(res.archive));
        const curlFile = Object.keys(unpacked).find(n => n.startsWith('shell-curl/') && !n.endsWith('/'))!;
        const content = strFromU8(unpacked[curlFile]);
        expect(content.toLowerCase()).to.not.include('content-length');
        expect(content).to.not.include(':authority');
        // Snippets are trimmed, matching the single-snippet export:
        expect(content).to.equal(content.trim());
    });

    it('exports placeholder text for binary request bodies, not a silently bodiless request', async () => {
        const har: any = makeHar(1);
        har.log.entries[0].request.method = 'POST';
        // Binary bodies can't be represented in HAR postData directly:
        // they're base64'd into _content & flagged via _requestBodyStatus:
        har.log.entries[0].request._requestBodyStatus = 'discarded:not-representable';
        har.log.entries[0].request._content = {
            text: '//4AAQ==', // Non-UTF8 bytes, base64 encoded
            size: 4,
            encoding: 'base64'
        };

        const res = await exportAsZip({
            har,
            formatIds: ['shell~~curl'],
            includeHar: false,
            httpToolkitVersion: 'test'
        });
        expect(res.snippetSuccessCount).to.equal(1);

        const unpacked = unzipSync(new Uint8Array(res.archive));
        const curlFile = Object.keys(unpacked).find(n => n.startsWith('shell-curl/') && !n.endsWith('/'))!;
        const content = strFromU8(unpacked[curlFile]);
        expect(content).to.include('UNREPRESENTABLE BINARY REQUEST BODY');
    });

    it('exports placeholder text for undecodable request bodies', async () => {
        const har: any = makeHar(1);
        har.log.entries[0].request.method = 'POST';
        har.log.entries[0].request._requestBodyStatus = 'discarded:not-decodable';

        const res = await exportAsZip({
            har,
            formatIds: ['shell~~curl'],
            includeHar: false,
            httpToolkitVersion: 'test'
        });
        expect(res.snippetSuccessCount).to.equal(1);

        const unpacked = unzipSync(new Uint8Array(res.archive));
        const curlFile = Object.keys(unpacked).find(n => n.startsWith('shell-curl/') && !n.endsWith('/'))!;
        const content = strFromU8(unpacked[curlFile]);
        expect(content).to.include('REQUEST BODY COULD NOT BE DECODED');
    });

    it('surfaces per-snippet errors as partial failures, not overall rejection', async () => {
        // clj-http's converter crashes on JSON bodies containing nulls
        // (e.g. GraphQL requests with `variables: null`). That should
        // produce an error record, while the export itself succeeds:
        const harWithNullBody: any = makeHar(1);
        harWithNullBody.log.entries[0].request.method = 'POST';
        harWithNullBody.log.entries[0].request.postData = {
            mimeType: 'application/json',
            text: JSON.stringify({
                operationName: 'ThreadList',
                query: 'query ThreadList { threads { id } }',
                variables: null
            })
        };

        const res = await exportAsZip({
            har: harWithNullBody,
            formatIds: ['clojure~~clj_http'],
            includeHar: false,
            httpToolkitVersion: 'test'
        });

        expect(res.snippetSuccessCount).to.equal(0);
        expect(res.snippetErrorCount).to.equal(1);
        expect(res.errors).to.have.length(1);
        expect(res.errors[0].formatId).to.equal('clojure~~clj_http');

        const unpacked = unzipSync(new Uint8Array(res.archive));
        const manifest = JSON.parse(strFromU8(unpacked['manifest.json']));
        expect(manifest.errors).to.have.length(1);
        expect(manifest.errors[0].formatId).to.equal('clojure~~clj_http');
    });

    it('rejects empty request sets instead of producing an empty archive', async () => {
        await expect(exportAsZip({
            har: makeHar(0),
            formatIds: ['shell~~curl'],
            includeHar: false,
            httpToolkitVersion: 'test'
        })).to.be.rejectedWith('No HTTP requests available for ZIP export');
    });

    it('rejects empty format selections instead of producing an empty archive', async () => {
        await expect(exportAsZip({
            har: makeHar(1),
            formatIds: [],
            includeHar: false,
            httpToolkitVersion: 'test'
        })).to.be.rejectedWith('Nothing selected for ZIP export');
    });

    it('skips unrecognized format ids, rejecting if none are left', async () => {
        await expect(exportAsZip({
            har: makeHar(1),
            formatIds: ['nonsense~~nonsense'],
            includeHar: false,
            httpToolkitVersion: 'test'
        })).to.be.rejectedWith('Nothing selected for ZIP export');
    });

    it('omits requests.har when includeHar is false', async () => {
        const res = await exportAsZip({
            har: makeHar(2),
            formatIds: ['shell~~curl'],
            includeHar: false,
            httpToolkitVersion: 'test'
        });

        const names = Object.keys(unzipSync(new Uint8Array(res.archive)));
        expect(names).to.not.include('requests.har');
        expect(names).to.include('manifest.json');
        expect(names.filter(n => n.startsWith('shell-curl/') && !n.endsWith('/'))).to.have.length(2);
    });

    it('supports HAR-only exports, with no snippet formats at all', async () => {
        const res = await exportAsZip({
            har: makeHar(2),
            formatIds: [],
            includeHar: true,
            httpToolkitVersion: 'test'
        });

        expect(res.snippetSuccessCount).to.equal(0);
        expect(res.snippetErrorCount).to.equal(0);

        const unpacked = unzipSync(new Uint8Array(res.archive));
        const names = Object.keys(unpacked).filter(n => !n.endsWith('/'));
        expect(names.sort()).to.deep.equal(['manifest.json', 'requests.har']);

        const manifest = JSON.parse(strFromU8(unpacked['manifest.json']));
        expect(manifest.formats).to.have.length(0);
        expect(manifest.requestCount).to.equal(2);
    });

    it('error records reference the request by entryIndex, recoverable via entries', async () => {
        const har: any = makeHar(3);
        for (const entry of har.log.entries) {
            entry.request.method = 'POST';
            // A JSON body parsing to top-level null crashes clj-http's
            // converter, so every entry fails for this format:
            entry.request.postData = {
                mimeType: 'application/json',
                text: 'null'
            };
        }

        const res = await exportAsZip({
            har,
            formatIds: ['clojure~~clj_http'],
            includeHar: false,
            httpToolkitVersion: 'test'
        });

        const unpacked = unzipSync(new Uint8Array(res.archive));
        const manifest = JSON.parse(strFromU8(unpacked['manifest.json']));
        expect(manifest.errors).to.have.length(3);
        for (let i = 0; i < 3; i++) {
            const e = manifest.errors[i];
            expect(e.entryIndex).to.equal(i);
            expect(e.formatId).to.equal('clojure~~clj_http');
            expect(e.error).to.be.a('string').and.not.empty;

            // The full request context lives in the entries list, not the
            // error record, so it isn't duplicated:
            const entry = manifest.entries[e.entryIndex];
            expect(entry.method).to.equal('POST');
            expect(entry.url).to.include('example.com/item/');
            expect(entry.status).to.equal(200);
        }
    });

    it('produces filenames that embed the response status code', async () => {
        const res = await exportAsZip({
            har: makeHar(2),
            formatIds: ['shell~~curl'],
            includeHar: false,
            httpToolkitVersion: 'test'
        });
        const unpacked = unzipSync(new Uint8Array(res.archive));
        const files = Object.keys(unpacked).filter(n => n.startsWith('shell-curl/') && !n.endsWith('/'));
        for (const f of files) {
            expect(f).to.match(/_200_/);
        }
    });

    it('preserves raw postData.text for form-encoded requests', async () => {
        const harWithFormBody: any = makeHar(1);
        harWithFormBody.log.entries[0].request.method = 'POST';
        harWithFormBody.log.entries[0].request.postData = {
            mimeType: 'application/x-www-form-urlencoded',
            params: [{ name: 'key', value: 'value' }, { name: 'msg', value: 'hello' }],
            text: 'key=value&msg=hello'
        };

        const res = await exportAsZip({
            har: harWithFormBody,
            formatIds: ['shell~~curl'],
            includeHar: false,
            httpToolkitVersion: 'test'
        });
        expect(res.snippetSuccessCount).to.equal(1);
        expect(res.snippetErrorCount).to.equal(0);

        const unpacked = unzipSync(new Uint8Array(res.archive));
        const curlFile = Object.keys(unpacked).find(n => n.startsWith('shell-curl/') && !n.endsWith('/'))!;
        const content = strFromU8(unpacked[curlFile]);
        // The raw text body (not the params array) should drive snippet generation
        expect(content).to.include('key=value');
    });
});
