// Requiring modules and then 'forge', rather than just the root package, lets us
// precisely filter exactly the code in our bundle.
require('node-forge/lib/util');
require('node-forge/lib/asn1');
require('node-forge/lib/pki');
require('node-forge/lib/pkcs12');
import * as forge from 'node-forge/lib/forge';
import { isErrorLike } from '../util/error';

export type ValidationResult =
    | 'valid'
    | 'invalid-format'
    | 'invalid-passphrase'
    | 'missing-cert'
    | 'missing-key';

const pkcs12ContainsBag = (pfx: forge.pkcs12.Pkcs12Pfx, bagType: string) =>
    pfx.getBags({ bagType })[bagType]?.length;

export function validatePKCS12(
    data: ArrayBuffer,
    passphrase: string | undefined
): ValidationResult {
    let asn1Data: forge.asn1.Asn1;
    try {
        asn1Data = forge.asn1.fromDer(forge.util.createBuffer(data));
    } catch (e) {
        console.log(e);
        return 'invalid-format';
    }

    try {
        // Decrypt the PKCS12 with the passphrase - we assume if this works, it's good.
        // Could be false (different key on cert within, who knows what else), but typically not.
        const pfx = forge.pkcs12.pkcs12FromAsn1(asn1Data, passphrase);

        if (!pkcs12ContainsBag(pfx, forge.pki.oids.pkcs8ShroudedKeyBag)) {
            return 'missing-key';
            // There is also oids.keyBag, but AFAICT that's not what we need here generally.
        }

        if (!pkcs12ContainsBag(pfx, forge.pki.oids.certBag)) {
            return 'missing-cert';
        }

        return 'valid';
    } catch (e) {
        console.log(e);
        if (isErrorLike(e) && e.message?.includes('Invalid password')) {
            return 'invalid-passphrase';
        } else {
            // E.g. "ASN.1 object is not an PKCS#12 PFX."
            return 'invalid-format';
        }
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

    try {
        const certData = forge.pki.certificateFromPem(pemString);
        return {
            rawPEM: pemString,
            subject: {
                org: certData.subject.getField('O')?.value,
                name: certData.subject.getField('CN')?.value
            },
            serial: certData.serialNumber
        };
    } catch (err: any) {
        if (err.message === 'Cannot read public key. OID is not RSA.') {
            // This probably means we have an ECDSA certificate. The structure
            // has validated, but Forge can't use it. We can still accept it
            // just fine though, because it works on the backend. Manually parse
            // the fields we care about here instead:
            return getBasicCertDetails(pemString);
        } else {
            throw err;
        }
    }
}

function getBasicCertDetails(pemCert: string): ParsedCertificate {
    // This is a *very* simplified version of the internals of forge.pki.certificateFromPem,
    // minus the RSA key type validation.
    const msg = forge.pem.decode(pemCert)[0];
    const asn1Data = forge.asn1.fromDer(msg.body, false);

    const certCapture: any = {};
    (forge.asn1 as any).validate(asn1Data, X509MinimalStructure, certCapture);

    const subjectAttrs: Array<{
        shortName: string,
        value: string
    }> = (forge.pki as any).RDNAttributesAsArray(certCapture.certSubject);

    return {
        rawPEM: pemCert,
        subject: {
            name: subjectAttrs.find((attr) => attr.shortName === 'CN')?.value,
            org: subjectAttrs.find((attr) => attr.shortName === 'O')?.value,
        },
        serial: forge.util.createBuffer(certCapture.certSerialNumber).toHex()
    }
}

export function derToPem(der: ArrayBuffer) {
    const asnObj = forge.asn1.fromDer(forge.util.createBuffer(der));
    const asn1Cert = forge.pki.certificateFromAsn1(asnObj);
    return forge.pki.certificateToPem(asn1Cert);
};

// The absolute minimal structure of X509 certificate that we need for our parsing here. We only
// use this in the case that Forge can't validate a cert due to key type, so we need a fallback.
const X509MinimalStructure = {
    name: 'Certificate',
    tagClass: forge.asn1.Class.UNIVERSAL,
    type: forge.asn1.Type.SEQUENCE,
    constructed: true,
    value: [{
        name: 'Certificate.TBSCertificate',
        tagClass: forge.asn1.Class.UNIVERSAL,
        type: forge.asn1.Type.SEQUENCE,
        constructed: true,
        value: [{
            name: 'Certificate.TBSCertificate.version',
            tagClass: forge.asn1.Class.CONTEXT_SPECIFIC,
            type: 0,
            constructed: true,
            optional: true,
            value: []
        }, {
            name: 'Certificate.TBSCertificate.serialNumber',
            tagClass: forge.asn1.Class.UNIVERSAL,
            type: forge.asn1.Type.INTEGER,
            constructed: false,
            capture: 'certSerialNumber'
        }, {
            name: 'Certificate.TBSCertificate.signature',
            tagClass: forge.asn1.Class.UNIVERSAL,
            type: forge.asn1.Type.SEQUENCE,
            constructed: true,
            value: []
        }, {
            name: 'Certificate.TBSCertificate.issuer',
            tagClass: forge.asn1.Class.UNIVERSAL,
            type: forge.asn1.Type.SEQUENCE,
            constructed: true
        }, {
            name: 'Certificate.TBSCertificate.validity',
            tagClass: forge.asn1.Class.UNIVERSAL,
            type: forge.asn1.Type.SEQUENCE,
            constructed: true,
            value: []
        }, {
            name: 'Certificate.TBSCertificate.subject',
            tagClass: forge.asn1.Class.UNIVERSAL,
            type: forge.asn1.Type.SEQUENCE,
            constructed: true,
            captureAsn1: 'certSubject'
        }]
    }]
};