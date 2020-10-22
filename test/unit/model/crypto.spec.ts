import { expect } from '../../test-setup';

import { validatePKCS12 } from "../../../src/model/crypto";

const loadFixture = async (name: string) => {
    const response = await fetch('/fixtures/' + name);
    if (response.ok) {
        return await response.arrayBuffer();
    } else {
        throw new Error(`Failed to load ${name} with ${response.status}`);
    }
}

describe("validatePfx", () => {

    // A manually generated PFX (using the Mockttp test cert+key)
    let goodPfxData: ArrayBuffer;
    // The same PFX, with some random corruption added
    let corruptPfxData: ArrayBuffer;
    // The published p12 from badssl.com
    let badSslPfxData: ArrayBuffer;

    before(async () => {
        goodPfxData = await loadFixture('test.pfx');
        corruptPfxData = await loadFixture('corrupt.pfx');
        badSslPfxData = await loadFixture('badssl.p12');
    });

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