
import { isProbablyUtf8 } from "../../../src/util/buffer";
import { expect } from "../../test-setup";

describe("Buffer utils", () => {
    describe("isProbablyUtf8", () => {
        it("returns true for empty string", () => {
            expect(
                isProbablyUtf8(Buffer.from(""))
            ).to.equal(true);
        });

        it("returns true for a short UTF-8 string", () => {
            expect(
                isProbablyUtf8(Buffer.from("hello world"))
            ).to.equal(true);
        });

        it("returns false for a short binary string", () => {
            expect(
                isProbablyUtf8(Buffer.from([
                    // The header for a PNG
                    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
                ]))
            ).to.equal(false);
        });

        it("returns true for >1KB ASCII string", () => {
            expect(
                isProbablyUtf8(Buffer.alloc(4096).fill(
                    'hello'
                ))
            ).to.equal(true);
        });

        it("returns true for >1KB multibyte UTF-8 string", () => {
            expect(
                isProbablyUtf8(Buffer.alloc(4096).fill(
                    '你好' // Hello in chinese (2x 3-byte chars)
                    // N.b. 1024 is not divisible by 3, so this
                    // tests char-split detection
                ))
            ).to.equal(true);
        });

        it("returns true for an exactly 1026 byte multibyte UTF-8 string", () => {
            expect(
                isProbablyUtf8(Buffer.alloc(1026).fill(
                    '你好' // Hello in chinese (2x 3-byte chars)
                    // 1026 is divisible by 3, but this means we run out of
                    // buffer looking for the next UTF-8 char from 1024+
                ))
            ).to.equal(true);
        });

        it("returns false for >1KB binary string", () => {
            expect(
                isProbablyUtf8(Buffer.alloc(4096).fill(
                    Buffer.from([
                        // The header for a PNG
                        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
                    ])
                ))
            ).to.equal(false);
        });

        it("returns false for >1KB binary string of continuation bytes", () => {
            expect(
                isProbablyUtf8(Buffer.from(
                    Buffer.alloc(4096).fill(Buffer.from([
                        0xba // All continuation bytes
                    ]))
                ))
            ).to.equal(false);
        });
    });
})