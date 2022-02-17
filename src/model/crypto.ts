// Requiring modules and then 'forge', rather than just the root package, lets us
// precisely filter exactly the code in our bundle.
require('node-forge/lib/util');
require('node-forge/lib/asn1');
require('node-forge/lib/pki');
require('node-forge/lib/pkcs12');
import * as forge from 'node-forge/lib/forge';

export type ValidationResult = 'valid' | 'invalid-format' | 'invalid-passphrase';

export function validatePKCS12(
    data: ArrayBuffer,
    passphrase: string | undefined
): ValidationResult {
    let asn1Data: forge.asn1.Asn1;
    try {
        asn1Data = forge.asn1.fromDer(forge.util.createBuffer(data));
    } catch (e) {
        console.log(e.message);
        return 'invalid-format';
    }

    try {
        // Decrypt the PKCS12 with the passphrase - we assume if this works, it's good.
        // Could be false (different key on cert within, who knows what else), but typically not.
        forge.pkcs12.pkcs12FromAsn1(asn1Data, passphrase);
        return 'valid';
    } catch (e) {
        console.log(e.message);
        return 'invalid-passphrase';
    }
}

export type ParsedCertificate = {
    rawPEM: string;
    subject: {
        org?: string;
        name?: string;
    };
    serial: string;
};

export function parseCert(cert: ArrayBuffer): ParsedCertificate {
    const magicNumbers = new Uint8Array(cert, 0, 2);
    const isDER = (magicNumbers[0] === 0x30 && magicNumbers[1] === 0x82);

    // We need PEM at the end of the day (we're passing this eventually into Node's
    // TLS APIs, which want PEM CA certs) so we convert DER to PEM here.

    const certBuffer = isDER
        ? derToPem(cert) // Looks like it's DER encoded - transform to PEM
        : forge.util.createBuffer(cert) // Otherwise it's probably PEM

    const pemString = certBuffer.toString();
    const certData = forge.pki.certificateFromPem(pemString);

    return {
        rawPEM: pemString,
        subject: {
            org: certData.subject.getField('O')?.value,
            name: certData.subject.getField('CN')?.value
        },
        serial: certData.serialNumber
    };
}

export function derToPem(der: ArrayBuffer) {
    const asnObj = forge.asn1.fromDer(forge.util.createBuffer(der));
    const asn1Cert = forge.pki.certificateFromAsn1(asnObj);
    return forge.pki.certificateToPem(asn1Cert);
};