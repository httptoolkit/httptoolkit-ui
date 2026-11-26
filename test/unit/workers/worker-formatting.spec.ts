import * as zlib from 'zlib';

import { expect } from '../../test-setup';

import { formatBufferAsync } from '../../../src/services/ui-worker-api';

const bufferFromHex = (hex: string) => Buffer.from(hex.replace(/:/g, ''), 'hex');

describe('Worker formatting', function () {

    before(async function () {
        this.timeout(10000);
        // The first worker request is slow (see worker-decoding.spec.ts), so warm it up:
        await formatBufferAsync(bufferFromHex('08:01'), 'protobuf');
    });

    it('should format protobuf via the worker', async () => {
        // #1 = "hi", #2 = a value too large to be an exact JS number
        const formatted = await formatBufferAsync(
            bufferFromHex('0a:02:68:69:10:81:80:80:80:80:80:80:10'),
            'protobuf'
        );

        expect(formatted).to.equal([
            '{',
            '  "1": "hi",',
            '  "2": 9007199254740993',
            '}'
        ].join('\n'));
    });

    it('should format only the bytes of a buffer view', async () => {
        const backing = Buffer.from('before<p>hello</p>after');
        const view = backing.subarray(6, 18);

        const formatted = await formatBufferAsync(view, 'html');

        expect(formatted).to.equal('<p>hello</p>');
        expect(backing.toString()).to.equal('before<p>hello</p>after');
    });

    it('should format gzipped gRPC via the worker, using the given headers', async () => {
        const message = zlib.gzipSync(bufferFromHex('0a:0b:48:65:6c:6c:6f:20:57:6f:72:6c:64')); // #1 = "Hello World"
        const lengthPrefix = Buffer.alloc(5);
        lengthPrefix.writeUInt8(1); // Compressed
        lengthPrefix.writeUInt32BE(message.length, 1);

        const formatted = await formatBufferAsync(
            Buffer.concat([lengthPrefix, message]),
            'grpc-proto',
            { 'grpc-encoding': 'gzip' }
        );

        expect(formatted).to.equal([
            '{',
            '  "1": "Hello World"',
            '}'
        ].join('\n'));
    });

});
