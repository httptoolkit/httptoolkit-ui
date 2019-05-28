import * as zlib from 'zlib';

import { expect } from '../../test-setup';

import { decodeBody } from '../../../src/services/ui-worker-api';

describe('Worker decoding', () => {
    it('should decode a response with no encoding', async () => {
        const body = Buffer.from('hello world');
        const { decoded, encoded } = await decodeBody(body, []);

        expect(decoded.toString('utf8')).to.equal('hello world');
        expect(encoded.toString('utf8')).to.equal('hello world');
    });

    it('should decode a response with an encoding', async () => {
        const gzippedContent = zlib.gzipSync('Gzipped response');
        const body = Buffer.from(gzippedContent);

        const { decoded, encoded } = await decodeBody(body, ['gzip']);

        expect(decoded.toString('utf8')).to.equal('Gzipped response');
        expect(encoded.toString('utf8')).to.equal(gzippedContent.toString('utf8'));
    });

    it('should fail to decode a response with the wrong encoding', () => {
        return expect(
            decodeBody(Buffer.from('hello world'), ['randomized'])
        ).to.be.rejectedWith('Unknown encoding');
    });
});