import { expect } from '../../../test-setup';

import {
    Formatters,
    EditorFormatter,
    MAX_HEX_FORMAT_SIZE
} from '../../../../src/model/events/body-formatting';

describe('Body formatting', () => {

    describe('for hex', () => {
        const formatter = Formatters.raw as EditorFormatter;

        it('should render small content synchronously, in lines of 16 bytes', () => {
            const input = Buffer.from(Array.from({ length: 20 }, (_, i) => i));
            expect(formatter.render(input)).to.equal(
                '00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F\n' +
                '10 11 12 13'
            );
        });

        it('should render larger content asynchronously, in lines of 16 bytes', async () => {
            const input = Buffer.alloc(4096, 0xAB);
            const result = await formatter.render(input);
            const lines = result.split('\n');

            expect(lines.length).to.equal(256);
            expect(lines.every(l => l === Array(16).fill('AB').join(' '))).to.equal(true);
        });

        it('should truncate very large content', async function () {
            this.timeout(30000);

            const input = Buffer.alloc(MAX_HEX_FORMAT_SIZE + 100, 0x01);
            const result = await formatter.render(input);
            const lines = result.split('\n');

            expect(lines.length).to.equal(MAX_HEX_FORMAT_SIZE / 16 + 1);
            expect(lines[lines.length - 1]).to.equal('[-- Truncated to 4MB --]');
        });
    });

});
