import { expect } from '../../test-setup';

import { validatePKCS12 } from "../../../src/model/crypto";

// A manually generated PFX (using the Mockttp test cert+key)
import * as goodPfxData from 'arraybuffer-loader!../../fixtures/test.pfx';

// The same PFX, with some random corruption added
import * as corruptPfxData from 'arraybuffer-loader!../../fixtures/corrupt.pfx';

// The published p12 from badssl.com
import * as badSslPfxData from 'arraybuffer-loader!../../fixtures/badssl.p12';

describe("validatePfx", () => {

    it("should validate successfully with the right passphrase", () => {
        expect(
            validatePKCS12(goodPfxData, 'test-passphrase')
        ).to.equal('valid');
    });

    it("should fail to validate with the wrong passphrase", () => {
        expect(
            validatePKCS12(goodPfxData, 'wrong-passphrase')
        ).to.equal('invalid-passphrase');
    });

    it("should fail to validate with no passphrase", () => {
        expect(
            validatePKCS12(goodPfxData, undefined)
        ).to.equal('invalid-passphrase');
    });

    it("should fail to validate corrupted data", () => {
        expect(
            validatePKCS12(corruptPfxData, 'test-passphrase')
        ).to.equal('invalid-format');
    });

    it("should load real p12 from badssl.com", () => {
        expect(
            validatePKCS12(badSslPfxData, 'badssl.com')
        ).to.equal('valid');
    });
});