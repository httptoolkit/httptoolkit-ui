import { expect } from '../../test-setup';

import { validatePKCS12, parseCert } from "../../../src/model/crypto";

// A manually generated PFX (using the Mockttp test cert+key)
import * as goodPfxData from 'arraybuffer-loader!../../fixtures/test.pfx';

// The same PFX, with some random corruption added
import * as corruptPfxData from 'arraybuffer-loader!../../fixtures/corrupt.pfx';

// The published p12 from badssl.com
import * as badSslPfxData from 'arraybuffer-loader!../../fixtures/badssl.p12';

import * as rsaCaCert from 'arraybuffer-loader!../../fixtures/ca-cert-rsa.pem';
import * as ecdsaCaCert from 'arraybuffer-loader!../../fixtures/ca-cert-ecdsa.pem';

describe("validatePfx", function () {

    // Occasionally the success-case tests can time out in CI. Very unclear why, I suspect
    // some kind of data/lib loading delay somewhere? No apparent errors...

    this.retries(3);

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

describe("parseCert", () => {
    it("can parse an X509 RSA CA certification", () => {
        const cert = parseCert(rsaCaCert);

        expect(cert.subject.name).to.equal('HtkRsaTestCert');
        expect(cert.subject.org).to.equal('HtkTestOrg');
        expect(cert.serial).to.equal('6fad40ea0ea0c11e52d8e8654bb22c5ba940421c');
        expect(cert.rawPEM).to.match(/^-----BEGIN CERTIFICATE-----/);
    });

    it("can parse an X509 ECDSA CA certificate", () => {
        const cert = parseCert(ecdsaCaCert);

        expect(cert.subject.name).to.equal('HtkEcdsaTestCert');
        expect(cert.subject.org).to.equal('HtkTestOrg');
        expect(cert.serial).to.equal('57c1772f855d85c6fbfb06c1c20d24460ce25f0d');
        expect(cert.rawPEM).to.match(/^-----BEGIN CERTIFICATE-----/);
    });
});