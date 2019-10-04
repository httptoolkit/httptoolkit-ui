import { asn1, pkcs12, util as forgeUtil } from 'node-forge';

export type ValidationResult = 'valid' | 'invalid-format' | 'invalid-passphrase';

export function validatePKCS12(
    data: ArrayBuffer,
    passphrase: string | undefined
): ValidationResult {
    let asn1Data: asn1.Asn1;
    try {
        asn1Data = asn1.fromDer(forgeUtil.createBuffer(data));
    } catch (e) {
        console.log(e.message);
        return 'invalid-format';
    }

    try {
        // Decrypt the PKCS12 with the passphrase - we assume if this works, it's good.
        // Could be false (different key on cert within, who knows what else), but typically not.
        pkcs12.pkcs12FromAsn1(asn1Data, passphrase);
        return 'valid';
    } catch (e) {
        console.log(e.message);
        return 'invalid-passphrase';
    }
}