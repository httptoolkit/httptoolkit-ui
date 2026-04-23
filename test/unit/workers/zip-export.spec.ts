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

    const curlFormat = {
        id: 'shell~~curl',
        target: 'shell',
        client: 'curl',
        category: 'Shell',
        label: 'cURL',
        folderName: 'shell-curl',
        extension: 'sh'
    };

    it('produces a valid ZIP with snippets, HAR and manifest', async () => {
        const res = await exportAsZip({
            har: makeHar(2),
            formats: [curlFormat],
            toolVersion: 'test'
        });

        expect(res.cancelled).to.equal(false);
        expect(res.snippetErrorCount).to.equal(0);
        expect(res.snippetSuccessCount).to.equal(2);

        const unpacked = unzipSync(new Uint8Array(res.archive));
        const names = Object.keys(unpacked);
        expect(names).to.include('manifest.json');
        expect(names).to.include('requests.har');
        expect(names.filter(n => n.startsWith('shell-curl/') && !n.endsWith('/'))).to.have.length(2);

        const manifest = JSON.parse(strFromU8(unpacked['manifest.json']));
        expect(manifest.version).to.equal(1);
        expect(manifest.requestCount).to.equal(2);
        expect(manifest.formats).to.have.length(1);
        expect(manifest.errors).to.have.length(0);
    });

    it('can be cancelled mid-flight', async () => {
        const controller = new AbortController();
        const p = exportAsZip({
            har: makeHar(200),
            formats: [curlFormat],
            toolVersion: 'test',
            signal: controller.signal
        });
        setTimeout(() => controller.abort(), 5);
        const res = await p;
        expect(res.cancelled).to.equal(true);
    });

    it('filters content-length / pseudo-headers before snippet generation', async () => {
        const res = await exportAsZip({
            har: makeHar(1),
            formats: [curlFormat],
            toolVersion: 'test'
        });
        const unpacked = unzipSync(new Uint8Array(res.archive));
        const curlFile = Object.keys(unpacked).find(n => n.startsWith('shell-curl/') && !n.endsWith('/'))!;
        const content = strFromU8(unpacked[curlFile]);
        expect(content.toLowerCase()).to.not.include('content-length');
        expect(content).to.not.include(':authority');
    });

    it('surfaces per-snippet errors as partial failures, not overall rejection', async () => {
        const bogusFormat = {
            id: 'nonsense~~nonsense',
            target: 'nonsense',
            client: 'nonsense',
            category: 'Nonsense',
            label: 'Nonsense',
            folderName: 'nonsense',
            extension: 'txt'
        };

        const res = await exportAsZip({
            har: makeHar(1),
            formats: [bogusFormat],
            toolVersion: 'test'
        });
        expect(res.snippetSuccessCount).to.equal(0);
        expect(res.snippetErrorCount).to.equal(1);
        const unpacked = unzipSync(new Uint8Array(res.archive));
        const manifest = JSON.parse(strFromU8(unpacked['manifest.json']));
        expect(manifest.errors).to.have.length(1);
        expect(manifest.errors[0].formatId).to.equal('nonsense~~nonsense');
    });

    it('rejects empty request sets instead of producing an empty archive', async () => {
        await expect(exportAsZip({
            har: makeHar(0),
            formats: [curlFormat],
            toolVersion: 'test'
        })).to.be.rejectedWith('No HTTP requests available for ZIP export');
    });

    it('rejects empty format selections instead of producing an empty archive', async () => {
        await expect(exportAsZip({
            har: makeHar(1),
            formats: [],
            toolVersion: 'test'
        })).to.be.rejectedWith('No formats selected for ZIP export');
    });

    it('error records carry full request context (entryIndex, method, url, status)', async () => {
        const bogusFormat = {
            id: 'nonsense~~nonsense',
            target: 'nonsense',
            client: 'nonsense',
            category: 'Nonsense',
            label: 'Bogus Format',
            folderName: 'bogus',
            extension: 'txt'
        };
        const res = await exportAsZip({
            har: makeHar(3),
            formats: [bogusFormat],
            toolVersion: 'test'
        });
        const unpacked = unzipSync(new Uint8Array(res.archive));
        const manifest = JSON.parse(strFromU8(unpacked['manifest.json']));
        expect(manifest.errors).to.have.length(3);
        for (let i = 0; i < 3; i++) {
            const e = manifest.errors[i];
            expect(e.entryIndex).to.equal(i);
            expect(e.method).to.equal('GET');
            expect(e.url).to.include('example.com/item/');
            expect(e.status).to.equal(200);
            expect(e.format).to.equal('Bogus Format');
            expect(e.formatId).to.equal('nonsense~~nonsense');
        }
        expect(Object.keys(unpacked)).to.include('_errors.json');
        const standalone = JSON.parse(strFromU8(unpacked['_errors.json']));
        expect(standalone.errors).to.have.length(3);
    });

    it('produces filenames that embed the response status code', async () => {
        const res = await exportAsZip({
            har: makeHar(2),
            formats: [curlFormat],
            toolVersion: 'test'
        });
        const unpacked = unzipSync(new Uint8Array(res.archive));
        const files = Object.keys(unpacked).filter(n => n.startsWith('shell-curl/') && !n.endsWith('/'));
        for (const f of files) {
            expect(f).to.match(/_200_/);
        }
    });

    it('truncates large request bodies with a pointer to requests.har', async () => {
        const largeBody = 'A'.repeat(2000);
        const harWithBody: any = makeHar(1);
        harWithBody.log.entries[0].request.postData = {
            mimeType: 'text/plain',
            text: largeBody
        };

        const res = await exportAsZip({
            har: harWithBody,
            formats: [curlFormat],
            toolVersion: 'test',
            snippetBodySizeLimit: 100
        });
        const unpacked = unzipSync(new Uint8Array(res.archive));
        const curlFile = Object.keys(unpacked).find(n => n.startsWith('shell-curl/') && !n.endsWith('/'))!;
        const content = strFromU8(unpacked[curlFile]);
        expect(content).to.include('REQUEST BODY TRUNCATED');
        expect(content).to.include('requests.har');
        expect(content).to.not.include('A'.repeat(500));
        const harInZip = JSON.parse(strFromU8(unpacked['requests.har']));
        expect(harInZip.log.entries[0].request.postData.text).to.equal(largeBody);
    });

    it('passes bodies through when snippetBodySizeLimit is not set', async () => {
        const body = 'B'.repeat(500);
        const harWithBody: any = makeHar(1);
        harWithBody.log.entries[0].request.postData = {
            mimeType: 'text/plain',
            text: body
        };
        const res = await exportAsZip({
            har: harWithBody,
            formats: [curlFormat],
            toolVersion: 'test'
        });
        const unpacked = unzipSync(new Uint8Array(res.archive));
        const curlFile = Object.keys(unpacked).find(n => n.startsWith('shell-curl/') && !n.endsWith('/'))!;
        const content = strFromU8(unpacked[curlFile]);
        expect(content).to.not.include('REQUEST BODY TRUNCATED');
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
            formats: [curlFormat],
            toolVersion: 'test'
        });
        expect(res.snippetSuccessCount).to.equal(1);
        expect(res.snippetErrorCount).to.equal(0);

        const unpacked = unzipSync(new Uint8Array(res.archive));
        const curlFile = Object.keys(unpacked).find(n => n.startsWith('shell-curl/') && !n.endsWith('/'))!;
        const content = strFromU8(unpacked[curlFile]);
        // The raw text body (not the params array) should drive snippet generation
        expect(content).to.include('key=value');
    });

    it('recovers clj-http crashes on nested-null JSON bodies via ultra-safe retry', async () => {
        // Repro: concrete GraphQL body as observed in mydealz / recombee —
        // `variables: null` or `persistedQuery: null` triggers a
        // "Cannot read properties of null (reading 'constructor')" in
        // clj-http's `jsType(null).constructor.name`. The two-stage
        // retry (reduced -> ultra-safe) must still produce the snippet.
        const graphqlBody = JSON.stringify({
            operationName: 'ThreadList',
            query: 'query ThreadList { threads { id } }',
            variables: null,
            extensions: { persistedQuery: null }
        });
        const harWithNullBody: any = makeHar(1);
        harWithNullBody.log.entries[0].request.method = 'POST';
        harWithNullBody.log.entries[0].request.postData = {
            mimeType: 'application/json',
            text: graphqlBody
        };

        const cljFormat = {
            id: 'clojure~~clj_http',
            target: 'clojure',
            client: 'clj_http',
            category: 'Clojure',
            label: 'clj-http',
            folderName: 'clojure-clj_http',
            extension: 'clj'
        };

        const res = await exportAsZip({
            har: harWithNullBody,
            formats: [cljFormat],
            toolVersion: 'test'
        });

        // Success, not an error in the manifest.
        expect(res.snippetSuccessCount).to.equal(1);
        expect(res.snippetErrorCount).to.equal(0);
        const unpacked = unzipSync(new Uint8Array(res.archive));
        const manifest = JSON.parse(strFromU8(unpacked['manifest.json']));
        expect(manifest.errors).to.have.length(0);
        // File was actually written and contains the clj-http client
        // require (smoke test that it is not an empty file).
        const cljFile = Object.keys(unpacked).find(n =>
            n.startsWith('clojure-clj_http/') && !n.endsWith('/')
        )!;
        expect(cljFile).to.match(/_200_/);
        const content = strFromU8(unpacked[cljFile]);
        expect(content).to.include('clj-http.client');
    });

    it('recovers clj-http crashes on JSON body that parses to top-level null', async () => {
        // Variant: `JSON.parse(text) === null` directly. Leads to
        // `params[form-params] = null` in clj-http and crashes the
        // `filterEmpty` pass. Must be caught by ultra-safe retry.
        const harWithTopLevelNull: any = makeHar(1);
        harWithTopLevelNull.log.entries[0].request.method = 'POST';
        harWithTopLevelNull.log.entries[0].request.postData = {
            mimeType: 'application/json',
            text: 'null'
        };

        const cljFormat = {
            id: 'clojure~~clj_http',
            target: 'clojure',
            client: 'clj_http',
            category: 'Clojure',
            label: 'clj-http',
            folderName: 'clojure-clj_http',
            extension: 'clj'
        };

        const res = await exportAsZip({
            har: harWithTopLevelNull,
            formats: [cljFormat],
            toolVersion: 'test'
        });

        expect(res.snippetSuccessCount).to.equal(1);
        expect(res.snippetErrorCount).to.equal(0);
    });
});
