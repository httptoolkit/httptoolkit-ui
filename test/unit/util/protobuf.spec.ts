import { expect } from "../../test-setup";

import { isProbablyProtobuf } from "../../../src/util/protobuf";

describe("isProbablyProtobuf", () => {

    it("should not recognize empty data as Protobuf", () => {
        expect(
            isProbablyProtobuf(Buffer.from(''))
        ).to.equal(false);
    });

    it("should not recognize JSON as Protobuf", () => {
        expect(
            isProbablyProtobuf(Buffer.from('{}', 'utf8'))
        ).to.equal(false);
    });

    it("should not recognize HTML as Protobuf", () => {
        expect(
            isProbablyProtobuf(Buffer.from('<!DOCTYPE html>', 'utf8'))
        ).to.equal(false);
    });

    it("should recognize basic protobuf", () => {
        expect(
            isProbablyProtobuf(Buffer.from(
                // Field 1 - string - Hello World
                '0a 0b 48 65 6c 6c 6f 20 57 6f 72 6c 64',
                'hex'
            ))
        ).to.equal(true);
    });

    it("should not recognize protobuf with invalid field numbers", () => {
        expect(
            isProbablyProtobuf(Buffer.from(
                // Field 2^28 (invalid)
                'fa ff ff ff 08 0b 48 65 6c 6c 6f 20 77 6f 72 6c 64',
                'hex'
            ))
        ).to.equal(false);
    });

});