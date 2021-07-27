import * as React from 'react';
import * as semver from 'semver';

import { styled } from '../../styles';
import { WarningIcon } from '../../icons';
import { reportError } from '../../errors';

import { desktopVersion, versionSatisfies, DESKTOP_HEADER_LIMIT_CONFIGURABLE } from '../../services/service-versions';

import { clickOnEnter } from '../component-utils';
import { Button } from '../common/inputs';
import { ExchangeHeaderCard } from './exchange-card';

const HeaderExplanation = styled.p`
    width: 100%;
    margin-bottom: 10px;
    line-height: 1.2;

    a[href] {
        color: ${p => p.theme.linkColor};

        &:visited {
            color: ${p => p.theme.visitedLinkColor};
        }
    }
`;

const HeaderButton = styled(Button)`
    padding: 10px 20px;
    font-weight: bold;
    font-size: ${p => p.theme.textSize};

    margin: 10px 0 0 20px;
    align-self: stretch;
`;

type ErrorType =
    | 'untrusted'
    | 'expired'
    | 'wrong-host'
    | 'tls-error'
    | 'host-not-found'
    | 'host-unreachable'
    | 'dns-error'
    | 'connection-refused'
    | 'connection-reset'
    | 'timeout'
    | 'invalid-http-version'
    | 'invalid-method'
    | 'unparseable-url'
    | 'unparseable'
    | 'header-overflow'
    | 'invalid-headers'
    | 'unknown';

export function tagsToErrorType(tags: string[]): ErrorType | undefined {
    if (
        tags.includes("passthrough-error:SELF_SIGNED_CERT_IN_CHAIN") ||
        tags.includes("passthrough-error:DEPTH_ZERO_SELF_SIGNED_CERT") ||
        tags.includes("passthrough-error:UNABLE_TO_VERIFY_LEAF_SIGNATURE") ||
        tags.includes("passthrough-error:UNABLE_TO_GET_ISSUER_CERT_LOCALLY")
    ) {
        return 'untrusted';
    }

    if (tags.includes("passthrough-error:CERT_HAS_EXPIRED")) {
        return 'expired';
    }

    if (tags.includes("passthrough-error:ERR_TLS_CERT_ALTNAME_INVALID")) {
        return 'wrong-host';
    }

    if (
        tags.filter(t => t.startsWith("passthrough-tls-error:")).length > 0 ||
        tags.includes("passthrough-error:EPROTO") ||
        tags.includes("passthrough-error:ERR_SSL_WRONG_VERSION_NUMBER")
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
    if (tags.includes("passthrough-error:ETIMEDOUT")) return 'timeout';

    if (tags.includes("http-2") || tags.includes("client-error:HPE_INVALID_VERSION")) {
        return 'invalid-http-version';
    }

    if (tags.includes("client-error:HPE_INVALID_METHOD")) return 'invalid-method'; // QWE / HTTP/1.1
    if (tags.includes("client-error:HPE_INVALID_URL")) return 'unparseable-url'; // http://<unicode>
    if (
        tags.includes("client-error:HPE_INVALID_CONSTANT") || // GET / HTTQ <- incorrect constant char
        tags.includes("client-error:HPE_INVALID_EOF_STATE") // Unexpected 0-length packet in parser
    ) return 'unparseable'; // ABC/1.1
    if (tags.includes("client-error:HPE_HEADER_OVERFLOW")) return 'header-overflow'; // More than ~80KB of headers
    if (
        tags.includes("client-error:HPE_INVALID_CONTENT_LENGTH") ||
        tags.includes("client-error:HPE_INVALID_TRANSFER_ENCODING") ||
        tags.includes("client-error:HPE_INVALID_HEADER_TOKEN") || // Invalid received (req or res) headers
        tags.includes("client-error:HPE_UNEXPECTED_CONTENT_LENGTH") || // T-E with C-L
        tags.includes("passthrough-error:HPE_INVALID_HEADER_TOKEN") // Invalid headers upstream, e.g. after breakpoint
    ) return 'invalid-headers';

    if (
        tags.filter(t => t.startsWith("passthrough-error:")).length > 0 ||
        tags.filter(t => t.startsWith("client-error:")).length > 0
    ) {
        reportError(`Unrecognized error tag ${JSON.stringify(tags)}`);
        return 'unknown';
    }
}

function typeCheck<T extends string>(types: readonly T[]) {
    return (type: string): type is T => types.includes(type as T);
}

const isInitialRequestError = typeCheck([
    'invalid-http-version',
    'invalid-method',
    'unparseable',
    'unparseable-url',
    'header-overflow',
    'invalid-headers'
]);

const isClientBug = typeCheck([
    'unparseable',
    'unparseable-url',
    'invalid-headers'
]);

const wasNotForwarded = typeCheck([
    'untrusted',
    'expired',
    'wrong-host',
    'tls-error',
    'host-not-found',
    'host-unreachable',
    'dns-error',
    'connection-refused'
]);

const isWhitelistable = typeCheck([
    'untrusted',
    'expired',
    'wrong-host',
    'tls-error'
]);

const isMockable = typeCheck([
    'host-not-found',
    'host-unreachable',
    'dns-error',
    'connection-refused',
    'connection-reset',
    'timeout'
]);

export const ExchangeErrorHeader = (p: {
    isPaidUser: boolean,
    type: ErrorType,
    getPro: (source: string) => void,
    navigate: (path: string) => void,
    mockRequest: () => void,
    ignoreError: () => void
}) => {
    const advancedHeaderOverflowSupported =
        desktopVersion.state === 'fulfilled' &&
        semver.valid(desktopVersion.value as string) &&
        versionSatisfies(
            desktopVersion.value as string,
            DESKTOP_HEADER_LIMIT_CONFIGURABLE
        );

    return <ExchangeHeaderCard>
        <HeaderExplanation>
            <WarningIcon /> {
                isInitialRequestError(p.type) || p.type === 'unknown'
                ? <strong>This request could not be handled</strong>
                : <strong>This request was not forwarded successfully</strong>
            }
        </HeaderExplanation>

        <HeaderExplanation>
            { isInitialRequestError(p.type)
                ? <>
                    The client's request {
                        p.type === 'invalid-method'
                            ? 'used an unsupported HTTP method'
                        : p.type === 'invalid-http-version'
                            ? 'used an unsupported HTTP version'
                        : p.type === 'invalid-headers'
                            ? 'included an invalid or unparseable header'
                        : p.type === 'unparseable-url'
                            ? 'included an unparseable URL'
                        : p.type === 'header-overflow'
                            ? 'headers were too large to be processed'
                        : // unparseable
                            'could not be parsed'
                    }, so HTTP Toolkit did not handle this request.
                </>
            : wasNotForwarded(p.type)
                ? <>
                    The upstream server {
                        p.type === 'wrong-host'
                            ? 'responded with an HTTPS certificate for the wrong hostname'
                        : p.type === 'expired'
                            ? 'has an expired HTTPS certificate'
                        : p.type === 'untrusted'
                            ? 'has an untrusted HTTPS certificate'
                        : p.type === 'tls-error'
                            ? 'failed to complete a TLS handshake'
                        : p.type === 'host-unreachable'
                            ? 'was not reachable on your network connection'
                        : p.type === 'host-not-found' || p.type === 'dns-error'
                            ? 'hostname could be not found'
                        : // connection-refused
                            'refused the connection'
                    }, so HTTP Toolkit did not forward the request.
                </>
            : // Unknown/upstream issue:
                <>
                    The request failed because {
                        p.type === 'connection-reset'
                            ? 'the connection to the server was reset'
                        : p.type === 'timeout'
                            ? 'the connection to the server timed out'
                        : // unknown
                            'of an unknown error'
                    }, so HTTP Toolkit could not return a response.
                </>
            }
        </HeaderExplanation>

        { p.type === 'tls-error'
            ? <>
                <HeaderExplanation>
                    This could be caused by the server not supporting modern cipher
                    standards or TLS versions, requiring a client certificate that hasn't
                    been provided, or other TLS configuration issues.
                </HeaderExplanation>
                <HeaderExplanation>
                    { p.isPaidUser
                        ? <>
                            From the Settings page you can configure client certificates, or
                            whitelist this host to relax HTTPS requirements and allow
                            self-signed certificates, which may resolve some TLS issues.
                        </>
                        : <>
                            Pro users can relax HTTPS requirements for configured hosts to
                            accept older TLS versions and self-signed/invalid certificates, and
                            configure per-host client certificates for authentication.
                        </>
                    }
                </HeaderExplanation>
            </>
        : p.type === 'host-not-found'
            ? <>
                <HeaderExplanation>
                    This typically means the host doesn't exist, although it
                    could be an issue with your DNS or network configuration.
                </HeaderExplanation>
                <HeaderExplanation>
                    You can define mock responses for requests like this from the
                    Mock page, to return fake data even for servers and hostnames
                    that don't exist.
                </HeaderExplanation>
            </>
        : p.type === 'host-unreachable'
            ? <>
                <HeaderExplanation>
                    This is typically an issue with your network connection or the
                    host's DNS records.
                </HeaderExplanation>
                <HeaderExplanation>
                    You can define mock responses for requests like this from the
                    Mock page, to return fake data even for servers and hostnames
                    that aren't accessible.
                </HeaderExplanation>
            </>
        : p.type === 'dns-error'
            ? <>
                <HeaderExplanation>
                    The DNS server hit an unknown error looking up this hostname.
                    This is likely due to a issue in your DNS configuration or network
                    connectivity, and may just be a temporary issue.
                </HeaderExplanation>
                <HeaderExplanation>
                    You can define mock responses for requests like this from the
                    Mock page, to return fake data even for servers and hostnames
                    that don't exist or aren't accessible.
                </HeaderExplanation>
            </>
        : isWhitelistable(p.type)
            ? <HeaderExplanation>
                By default this is only allowed for localhost servers, but {
                    p.isPaidUser
                        ? 'other hosts can be added to the whitelist from the Settings page.'
                        : 'Pro users can whitelist other custom hosts.'
                }
            </HeaderExplanation>
        : p.type === 'connection-refused'
            ? <HeaderExplanation>
                This typically means the server isn't running right now on the port you're using,
                although it's possible this is an intermittent connection issue. You can either
                try again, or you can mock requests like this to avoid sending them upstream
                at all.
            </HeaderExplanation>
        : p.type === 'connection-reset'
            ? <HeaderExplanation>
                This could be due to a connection issue, or may be caused by an issue on the server.
                In many cases, this is an intermittent issue that will be solved by retrying
                the request. You can also mock requests like this, to avoid sending them upstream
                at all.
            </HeaderExplanation>
        : p.type === 'timeout'
            ? <HeaderExplanation>
                This could be due to connection issues, general issues on the server, or issues
                with handling this request specifically. This might be resolved by retrying
                the request, or you can mock requests like this to avoid sending them upstream
                at all.
            </HeaderExplanation>
        : isClientBug(p.type)
            ? <HeaderExplanation>
                This means the client sent HTTP Toolkit some fundamentally invalid data that does
                not follow the HTTP spec. That suggests either a major bug in the client, or that
                they're not sending HTTP at all.
            </HeaderExplanation>
        : p.type === 'header-overflow'
            ? <HeaderExplanation>
                { desktopVersion.value && advancedHeaderOverflowSupported
                    ? <>
                        This means the request included more than 100KB of headers. The HTTP specification
                        doesn't set a max length, but most servers will refuse to process anything longer
                        than 8KB. This is likely an issue with your client, but if necessary you can increase
                        the HTTP Toolkit limit by setting <code>max-http-header-size</code> using the <code>HTTPTOOLKIT_NODE_OPTIONS</code> environment variable.
                    </>
                : desktopVersion.value // Old desktop:
                    ? <>
                        In more recent HTTP Toolkit versions the built-in limit has been increased, so please
                        update HTTP Toolkit to handle requests like these.
                    </>
                : // Non-desktop use:
                    <>
                        The HTTP specification doesn't set a max length for HTTP headers, but most
                        servers will refuse to process anything longer than 8KB.
                    </>
                }
            </HeaderExplanation>
        : p.type === 'invalid-method'
            ? <HeaderExplanation>
                Because this method is unrecognized, HTTP Toolkit doesn't know how it should
                be handled, and cannot safely forward it on elsewhere. If you think this
                method should be supported, please <a
                    href='https://github.com/httptoolkit/httptoolkit/issues/new'
                >
                    get in touch
                </a>.
            </HeaderExplanation>
        : p.type === 'invalid-http-version'
            ? <HeaderExplanation>
                The client may be using a newer or experimental HTTP version that HTTP
                Toolkit doesn't yet support. If you think this version should be supported,
                please <a
                    href='https://github.com/httptoolkit/httptoolkit/issues/new'
                >
                    get in touch
                </a>.
            </HeaderExplanation>
        : // 'unknown':
            <HeaderExplanation>
                It's not clear what's gone wrong here, but for some reason HTTP Toolkit
                couldn't successfully and/or securely complete this request.
                This might be an intermittent issue, and may be resolved by retrying
                the request.
            </HeaderExplanation>
        }

        { isInitialRequestError(p.type) && <HeaderExplanation>
            The data shown below is a best guess from the data that was available
            and parseable, and may be incomplete or inaccurate.
        </HeaderExplanation> }

        <HeaderButton onClick={p.ignoreError} onKeyPress={clickOnEnter}>
            Ignore
        </HeaderButton>

        { isMockable(p.type)
            ? <HeaderButton onClick={p.mockRequest} onKeyPress={clickOnEnter}>
                Mock requests like this
            </HeaderButton>
        : isWhitelistable(p.type)
            ? (p.isPaidUser
                ? <HeaderButton onClick={() => p.navigate('/settings')} onKeyPress={clickOnEnter}>
                    Go to Settings
                </HeaderButton>
                : <HeaderButton
                    onClick={() => p.getPro(`error-header-${p.type}`)}
                    onKeyPress={clickOnEnter}
                >
                    Get Pro
                </HeaderButton>
            )
        : null }

    </ExchangeHeaderCard>;
};