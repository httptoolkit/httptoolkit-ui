import * as zlib from 'zlib';

import { expect } from '../../test-setup';

import { decodeBody } from '../../../src/workers/worker-api';

function body(content: Buffer) {
    return {
        buffer: content
    };
}

describe('Worker decoding', () => {
    it('should decode a response with no encoding', async () => {
        const result = await decodeBody(body(Buffer.from('hello world')), []);
        expect(result.toString('utf8')).to.equal('hello world');
    });

    it('should decode a response with an encoding', async () => {
        const content = Buffer.from(zlib.gzipSync('Gzipped response'));

        const result = await decodeBody(body(content), ['gzip']);

        expect(result.toString('utf8')).to.equal('Gzipped response');
    });

    it('should fail to decode a response with the wrong encoding', () => {
        return expect(
            decodeBody(body(Buffer.from('hello world')), ['randomized'])
        ).to.be.rejectedWith('Unknown encoding');
    });
});