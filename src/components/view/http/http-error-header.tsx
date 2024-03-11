import * as React from 'react';
import * as semver from 'semver';

import { WarningIcon } from '../../../icons';

import {
    desktopVersion,
    versionSatisfies,
    DESKTOP_HEADER_LIMIT_CONFIGURABLE
} from '../../../services/service-versions';

import { unreachableCheck } from '../../../util/error';

import {
    ErrorType,
    isClientBug,
    isInitialRequestError,
    isMockable,
    isWhitelistable,
    wasNotForwarded,
    wasResponseIssue,
    wasTimeout
} from '../../../model/http/error-types';

import { clickOnEnter } from '../../component-utils';
import {
    HeaderCard,
    HeaderText,
    HeaderButton
} from '../header-card';

export const HttpErrorHeader = (p: {
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

    return <HeaderCard>
        <HeaderText>
            <WarningIcon /> {
                isInitialRequestError(p.type)
                    ? <strong>This request could not be handled</strong>
                : wasNotForwarded(p.type)
                    ? <strong>This request was not forwarded successfully</strong>
                : // Forwarded but failed later, or unknown:
                    <strong>This exchange was not completed successfully</strong>
            } <WarningIcon />
        </HeaderText>

        <HeaderText>
            { isInitialRequestError(p.type)
                ? <>
                    The client's request {
                        p.type === 'invalid-method'
                            ? 'used an unsupported HTTP method'
                        : p.type === 'invalid-http-version'
                            ? 'used an unsupported HTTP version'
                        : p.type === 'invalid-headers'
                            ? 'included an invalid or unparseable header'
                        : p.type === 'client-unparseable-url'
                            ? 'included an unparseable URL'
                        : p.type === 'header-overflow'
                            ? 'headers were too large to be processed'
                        : p.type === 'client-unparseable'
                            ? 'could not be parsed'
                        : unreachableCheck(p.type)
                    }, so HTTP Toolkit did not handle this request.
                </>
            : wasNotForwarded(p.type)
                ? <>
                    The upstream server {
                        p.type === 'wrong-host'
                            ? 'responded with an HTTPS certificate for the wrong hostname'
                        : p.type === 'expired'
                            ? 'has an expired HTTPS certificate'
                        : p.type === 'not-yet-valid'
                            ? 'has an HTTPS certificate with a start date in the future'
                        : p.type === 'untrusted'
                            ? 'has an untrusted HTTPS certificate'
                        : p.type === 'tls-error'
                            ? 'failed to complete a TLS handshake'
                        : p.type === 'host-unreachable'
                            ? 'was not reachable on your network connection'
                        : p.type === 'host-not-found' || p.type === 'dns-error'
                            ? 'hostname could be not found'
                        : p.type === 'connection-refused'
                            ? 'refused the connection'
                        : unreachableCheck(p.type)
                    }, so HTTP Toolkit did not forward the request.
                </>
            : wasTimeout(p.type)
                ? <>
                    The request timed out {
                        p.type === 'client-timeout'
                            ? 'waiting for the client to send the complete request'
                        : p.type === 'server-timeout'
                            ? 'waiting for a response from the server'
                        : unreachableCheck(p.type)
                    }
                </>
            : p.type === 'client-abort'
                ? <>
                    The client unexpectedly disconnected during the request, so
                    the response could not be completed.
                </>
            : wasResponseIssue(p.type)
                ? <>
                    The upstream request failed because {
                        p.type === 'connection-reset'
                            ? 'the connection to the server was reset'
                        : p.type === 'server-unparseable'
                            ? 'the response from the server was unparseable'
                        : unreachableCheck(p.type)
                    }, so HTTP Toolkit could not return a response to the client.
                </>
            : p.type === 'unknown'
                ? <>
                    The request failed because of an unknown error,
                    so HTTP Toolkit could not return a response.
                </>
            : unreachableCheck(p.type)
        }
        </HeaderText>

        { p.type === 'tls-error'
            ? <>
                <HeaderText>
                    This could be caused by the server not supporting modern cipher
                    standards or TLS versions, requiring a client certificate that hasn't
                    been provided, or other TLS configuration issues.
                </HeaderText>
                <HeaderText>
                    { p.isPaidUser
                        ? <>
                            From the Settings page you can configure client certificates, or
                            whitelist this host to relax HTTPS requirements and allow
                            self-signed certificates, which may resolve some TLS issues.
                        </>
                        : <>
                            Pro users can relax HTTPS requirements for configured hosts to
                            accept older TLS configurations and self-signed/invalid certificates, and
                            configure per-host client certificates for authentication.
                        </>
                    }
                </HeaderText>
            </>
        : p.type === 'host-not-found'
            ? <>
                <HeaderText>
                    This typically means the host doesn't exist, although it
                    could be an issue with your DNS or network configuration.
                </HeaderText>
                <HeaderText>
                    You can define mock responses for requests like this from the
                    Mock page, to return fake data even for servers and hostnames
                    that don't exist.
                </HeaderText>
            </>
        : p.type === 'host-unreachable'
            ? <>
                <HeaderText>
                    This is typically an issue with your network connection or the
                    host's DNS records.
                </HeaderText>
                <HeaderText>
                    You can define mock responses for requests like this from the
                    Mock page, to return fake data even for servers and hostnames
                    that aren't accessible.
                </HeaderText>
            </>
        : p.type === 'dns-error'
            ? <>
                <HeaderText>
                    The DNS server hit an unknown error looking up this hostname.
                    This is likely due to a issue in your DNS configuration or network
                    connectivity, and may just be a temporary issue.
                </HeaderText>
                <HeaderText>
                    You can define mock responses for requests like this from the
                    Mock page, to return fake data even for servers and hostnames
                    that don't exist or aren't accessible.
                </HeaderText>
            </>
        : p.type === 'untrusted'
            ? <HeaderText>
                By default unrecognized certificate authorities (CAs) are only accepted for localhost servers, but {
                    p.isPaidUser
                        ? 'additional CAs can be trusted from the Settings page.'
                        : 'Pro users can trust additional CAs or disable HTTPS validation for a host entirely.'
                }
            </HeaderText>
        : isWhitelistable(p.type)
            ? <HeaderText>
                By default this is only allowed for localhost servers, but {
                    p.isPaidUser
                        ? 'other hosts can be added to the whitelist from the Settings page.'
                        : 'Pro users can whitelist other custom hosts.'
                }
            </HeaderText>
        : p.type === 'connection-refused'
            ? <HeaderText>
                This typically means the server isn't running on the port you're using, though
                it is possible this is an intermittent connection issue. You can either try
                again, or mock requests like this to avoid sending them upstream at all.
            </HeaderText>
        : p.type === 'connection-reset'
            ? <HeaderText>
                This could be due to a connection issue, or an issue with the server.
                This may be an intermittent issue that will be solved by retrying the request, or
                you can mock requests like this to avoid sending them upstream at all.
            </HeaderText>
        : p.type === 'client-abort'
            ? <HeaderText>
                This could be due to connection issues, problems within the client, or that
                the client simply no longer wanted to receive the response and closed the
                connection intentionally.
            </HeaderText>
        : p.type === 'client-timeout'
            ? <HeaderText>
                This could be due to connection issues, problems within the client, or delays
                generating the complete body of the request. This might be resolved by retrying
                the request, or sending a simpler request with a smaller or easier to generate body.
            </HeaderText>
        : p.type === 'server-timeout'
            ? <HeaderText>
                This could be due to connection issues, problems within the server, or issues
                with handling this request specifically. This might be resolved by retrying
                the request, or you can mock requests like this to avoid sending them upstream
                at all.
            </HeaderText>
        : isClientBug(p.type)
            ? <HeaderText>
                This means the client sent HTTP Toolkit some fundamentally invalid data that does
                not follow the HTTP spec. That suggests either a major bug in the client, or that
                they're not sending HTTP at all.
            </HeaderText>
        : p.type === 'server-unparseable'
            ? <HeaderText>
                This means the server sent HTTP Toolkit some fundamentally invalid data that does
                not follow the HTTP spec. That suggests either a major bug in the server, or that
                they're not sending HTTP at all.
            </HeaderText>
        : p.type === 'header-overflow'
            ? <HeaderText>
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
            </HeaderText>
        : p.type === 'invalid-method'
            ? <HeaderText>
                Because this method is unrecognized, HTTP Toolkit doesn't know how it should
                be handled, and cannot safely forward it on elsewhere. If you think this
                method should be supported, please <a
                    href='https://github.com/httptoolkit/httptoolkit/issues/new'
                >
                    get in touch
                </a>.
            </HeaderText>
        : p.type === 'invalid-http-version'
            ? <HeaderText>
                The client may be using a newer or experimental HTTP version that HTTP
                Toolkit doesn't yet support. If you think this version should be supported,
                please <a
                    href='https://github.com/httptoolkit/httptoolkit/issues/new'
                >
                    get in touch
                </a>.
            </HeaderText>
        : p.type === 'unknown'
            ? <HeaderText>
                It's not clear what's gone wrong here, but for some reason HTTP Toolkit
                couldn't successfully and/or securely complete this request.
                This might be an intermittent issue, and may be resolved by retrying
                the request.
            </HeaderText>
        : unreachableCheck(p.type)}

        { isInitialRequestError(p.type) && <HeaderText>
            The data shown below is a best guess from the data that was available
            and parseable, and may be incomplete or inaccurate.
        </HeaderText> }

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

    </HeaderCard>;
};