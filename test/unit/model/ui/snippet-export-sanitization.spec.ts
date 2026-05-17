import { expect } from '../../../test-setup';

import { simplifyHarEntryRequestForSnippetExport } from '../../../../src/model/ui/snippet-export-sanitization';

describe('snippet-export-sanitization', () => {
    it('drops hop-by-hop headers, strips empty query params and preserves raw postData text', () => {
        const sanitized = simplifyHarEntryRequestForSnippetExport({
            method: 'POST',
            url: 'https://example.com/path',
            httpVersion: 'HTTP/1.1',
            headers: [
                { name: 'Connection', value: 'keep-alive, x-transient' },
                { name: 'Keep-Alive', value: 'timeout=5' },
                { name: 'Transfer-Encoding', value: 'chunked' },
                { name: 'X-Transient', value: 'drop-me' },
                { name: 'X-Keep-Me', value: 'keep-me' }
            ],
            queryString: [
                { name: '', value: '' },
                { name: 'keep', value: '1' }
            ],
            cookies: [
                { name: 'session', value: 'secret' }
            ],
            headersSize: -1,
            bodySize: 7,
            postData: {
                mimeType: 'application/x-www-form-urlencoded',
                params: [{ name: 'keep', value: '1' }],
                text: 'keep=1'
            }
        } as any);

        expect(sanitized.headers).to.deep.equal([
            { name: 'X-Keep-Me', value: 'keep-me' }
        ]);
        expect(sanitized.queryString).to.deep.equal([
            { name: 'keep', value: '1' }
        ]);
        expect(sanitized.cookies).to.deep.equal([]);
        expect(sanitized.postData).to.deep.include({
            mimeType: 'application/x-www-form-urlencoded',
            text: 'keep=1'
        });
    });
});
