import { logError } from '../../errors';
import { typeCheck } from '../../util';

export type ErrorType =
    | 'untrusted'
    | 'expired'
    | 'not-yet-valid'
    | 'wrong-host'
    | 'tls-error'
    | 'host-not-found'
    | 'host-unreachable'
    | 'dns-error'
    | 'connection-refused'
    | 'connection-reset'
    | 'client-abort'
    | 'server-timeout'
    | 'client-timeout'
    | 'invalid-http-version'
    | 'invalid-method'
    | 'client-unparseable-url'
    | 'client-unparseable'
    | 'server-unparseable'
    | 'header-overflow'
    | 'invalid-headers'
    | 'unknown';

export const isInitialRequestError = typeCheck([
    'invalid-http-version',
    'invalid-method',
    'client-unparseable',
    'client-unparseable-url',
    'header-overflow',
    'invalid-headers'
]);

export const isClientBug = typeCheck([
    'client-unparseable',
    'client-unparseable-url',
    'invalid-headers'
]);

export const wasNotForwarded = typeCheck([
    'untrusted',
    'expired',
    'not-yet-valid',
    'wrong-host',
    'tls-error',
    'host-not-found',
    'host-unreachable',
    'dns-error',
    'connection-refused'
]);

export const wasServerIssue = typeCheck([
    'server-unparseable',
    'server-timeout',
    'connection-reset'
]);

export const wasResponseIssue = typeCheck([
    'server-unparseable',
    'connection-reset'
]);

export const wasTimeout = typeCheck([
    'client-timeout',
    'server-timeout'
]);

export const isWhitelistable = typeCheck([
    'untrusted',
    'expired',
    'not-yet-valid',
    'wrong-host',
    'tls-error'
]);

export const isMockable = typeCheck([
    'host-not-found',
    'host-unreachable',
    'dns-error',
    'connection-refused',
    'connection-reset',
    'server-timeout'
]);

export function tagsToErrorType(tags: string[]): ErrorType | undefined {
    if (
        tags.includes("passthrough-error:SELF_SIGNED_CERT_IN_CHAIN") ||
        tags.includes("passthrough-error:DEPTH_ZERO_SELF_SIGNED_CERT") ||
        tags.includes("passthrough-error:UNABLE_TO_VERIFY_LEAF_SIGNATURE") ||
        tags.includes("passthrough-error:UNABLE_TO_GET_ISSUER_CERT_LOCALLY")
    ) {
        return 'untrusted';
    }

    if (tags.includes("passthrough-error:CERT_HAS_EXPIRED")) return 'expired';
    if (tags.includes("passthrough-error:CERT_NOT_YET_VALID")) return 'not-yet-valid';
    if (tags.includes("passthrough-error:ERR_TLS_CERT_ALTNAME_INVALID")) return 'wrong-host';

    if (
        tags.filter(t => t.startsWith("passthrough-tls-error:")).length > 0 ||
        tags.includes("passthrough-error:EPROTO") ||
        tags.includes("passthrough-error:ERR_SSL_WRONG_VERSION_NUMBER") ||
        tags.includes("passthrough-error:ERR_SSL_DECRYPTION_FAILED_OR_BAD_RECORD_MAC") ||
        tags.includes("passthrough-error:ERR_SSL_CIPHER_OPERATION_FAILED") ||
        tags.includes("passthrough-error:ERR_SSL_BAD_RECORD_TYPE") ||
        tags.includes("passthrough-error:ERR_SSL_INTERNAL_ERROR")
    ) {
        return 'tls-error';
    }

    if (tags.includes("passthrough-error:ENOTFOUND")) return 'host-not-found';
    if (
        tags.includes("passthrough-error:EHOSTUNREACH") || // No known route to this host
        tags.includes("passthrough-error:ENETUNREACH") // Whole network is unreachable
    ) return 'host-unreachable';
    if (tags.includes("passthrough-error:EAI_AGAIN")) return 'dns-error';
    if (tags.includes("passthrough-error:ECONNREFUSED")) return 'connection-refused';
    if (tags.includes("passthrough-error:ECONNRESET")) return 'connection-reset';
    if (tags.includes("passthrough-error:ETIMEDOUT")) return 'server-timeout';
    if (
        tags.includes("passthrough-error:HPE_INVALID_CONSTANT") ||
        tags.includes("passthrough-error:ERR_INVALID_HTTP_TOKEN") ||
        tags.includes("passthrough-error:ERR_HTTP_INVALID_STATUS_CODE") ||
        tags.includes("passthrough-error:ERR_INVALID_CHAR")
    ) {
        return 'server-unparseable';
    }

    if (tags.includes("http-2") || tags.includes("client-error:HPE_INVALID_VERSION")) {
        return 'invalid-http-version';
    }

    if (tags.includes("client-error:HPE_INVALID_METHOD")) return 'invalid-method'; // QWE / HTTP/1.1
    if (tags.includes("client-error:HPE_INVALID_URL")) return 'client-unparseable-url'; // http://<unicode>
    if (
        tags.includes("client-error:HPE_INVALID_CONSTANT") || // GET / HTTQ <- incorrect constant char
        tags.includes("client-error:HPE_INVALID_EOF_STATE") // Unexpected 0-length packet in parser
    ) return 'client-unparseable'; // ABC/1.1
    if (tags.includes("client-error:HPE_HEADER_OVERFLOW")) return 'header-overflow'; // More than ~80KB of headers
    if (
        tags.includes("client-error:HPE_INVALID_CONTENT_LENGTH") ||
        tags.includes("client-error:HPE_INVALID_TRANSFER_ENCODING") ||
        tags.includes("client-error:HPE_INVALID_HEADER_TOKEN") || // Invalid received (req or res) headers
        tags.includes("client-error:HPE_UNEXPECTED_CONTENT_LENGTH") || // T-E with C-L
        tags.includes("passthrough-error:HPE_INVALID_HEADER_TOKEN") // Invalid headers upstream, e.g. after breakpoint
    ) return 'invalid-headers';

    if (tags.includes("client-error:ERR_HTTP_REQUEST_TIMEOUT")) return 'client-timeout';
    if (
        tags.includes("client-error:ECONNABORTED") ||
        tags.includes("client-error:EPIPE")
    ) return 'client-abort';

    if (
        tags.filter(t => t.startsWith("passthrough-error:")).length > 0 ||
        tags.filter(t => t.startsWith("client-error:")).length > 0
    ) {
        logError(`Unrecognized error tag ${JSON.stringify(tags)}`);
        return 'unknown';
    }
}