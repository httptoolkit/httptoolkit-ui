/**
 * Proxy host parsing and normalization utilities.
 * 
 * Supports multiple proxy host formats:
 * Case 0) host[:port]
 * Case 1) user[:pass]@host[:port] (standard format with credentials)
 * Case 2) host:port@user:pass
 * Case 3) host:port:user:pass
 * Case 4) user:pass:host:port
 * 
 * Cases 2-4 are normalized to case 1.
 */

// Sub-patterns for building regexes
const HOST_PATTERN = '[A-Za-z0-9\\-.]+';
const PORT_PATTERN = '\\d+';
// Disallow "@", "/" and ":" in username/password
export const CRED_PATTERN = '[^@/:]+';

// Regexes for matching different proxy host formats.
export const PROXY_HOST_REGEXES = [
    new RegExp(`^(${HOST_PATTERN})(:${PORT_PATTERN})?$`),
    new RegExp(`^(${CRED_PATTERN})(:${CRED_PATTERN})?@(${HOST_PATTERN})(:${PORT_PATTERN})?$`),
    new RegExp(`^(${HOST_PATTERN}):(${PORT_PATTERN})@(${CRED_PATTERN}):(${CRED_PATTERN})$`),
    new RegExp(`^(${HOST_PATTERN}):(${PORT_PATTERN}):(${CRED_PATTERN}):(${CRED_PATTERN})$`),
    new RegExp(`^(${CRED_PATTERN}):(${CRED_PATTERN}):(${HOST_PATTERN}):(${PORT_PATTERN})$`),
];

/**
 * Normalizes a proxy host string containing credentials into the standard form: user[:pass]@host[:port]
 *
 * If the input contains no credentials, it is returned unchanged.
 *
 * @param host - The proxy host value in any supported format
 * @returns The normalized proxy host string
 * @throws Error if the host does not match any supported format
 */
export const normalizeProxyHost = (host: string): string => {
    const idx = PROXY_HOST_REGEXES.findIndex(regex => regex.test(host));
    if (idx === -1) {
        throw new Error(`Proxy format does not match expected patterns: ${host}`);
    }

    const groups = host.match(PROXY_HOST_REGEXES[idx])!;

    switch (idx) {
        case 0:
        case 1:
            return host;
        case 2:
            return `${groups[3]}:${groups[4]}@${groups[1]}:${groups[2]}`;
        case 3:
            return `${groups[3]}:${groups[4]}@${groups[1]}:${groups[2]}`;
        case 4:
            return `${groups[1]}:${groups[2]}@${groups[3]}:${groups[4]}`;
        default:
            throw new Error(`Unexpected regex index: ${idx}`);
    }
};
