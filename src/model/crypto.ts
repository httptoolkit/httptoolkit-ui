// Requiring modules and then 'forge', rather than just the root package, lets us
// precisely filter exactly the code in our bundle.
require('node-forge/lib/util');
require('node-forge/lib/asn1');
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