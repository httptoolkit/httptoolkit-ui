import * as React from 'react';

import { styled } from '../../styles';
import { WarningIcon } from '../../icons';

import { clickOnEnter } from '../component-utils';
import { Button } from '../common/inputs';
import { ExchangeHeaderCard } from './exchange-card';

const HeaderExplanation = styled.p`
    width: 100%;
    margin-bottom: 10px;
    line-height: 1.2;
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
    | 'connection-refused'
    | 'connection-reset'
    | 'unknown';

function typeCheck<T extends string>(types: readonly T[]) {
    return (type: string): type is T => types.includes(type as T);
}

const wasNotForwarded = typeCheck([
    'untrusted',
    'expired',
    'wrong-host',
    'tls-error',
    'host-not-found',
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
    'connection-refused',
    'connection-reset'
]);

export const ExchangeErrorHeader = (p: {
    isPaidUser: boolean,
    type: ErrorType,
    getPro: (source: string) => void,
    navigate: (path: string) => void,
    mockRequest: () => void,
    ignoreError: () => void
}) =>
    <ExchangeHeaderCard>
        <HeaderExplanation>
            <WarningIcon /> <strong>This request was not forwarded successfully</strong>
        </HeaderExplanation>

        <HeaderExplanation>
            { wasNotForwarded(p.type)
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
                        : p.type === 'host-not-found'
                            ? 'hostname could be not found'
                        : // connection-refused
                            'refused the connection'
                    }, so HTTP Toolkit did not forward the request.
                </>
                : <>
                    The upstream request failed because {
                        p.type === 'connection-reset'
                            ? 'the connection was reset'
                        : // unknown
                            'of an unknown error'
                    }, so HTTP Toolkit could not return the response.
                </>
            }
        </HeaderExplanation>

        { p.type === 'tls-error'
            ? <>
                <HeaderExplanation>
                    This could be caused by the server not supporting modern cipher
                    standards, requiring a client certificate that hasn't been
                    provided, or other TLS configuration issues.
                </HeaderExplanation>
                <HeaderExplanation>
                    { p.isPaidUser
                        ? <>
                            You can configure client certificates or whitelist this
                            host's certificates, which may resolve some TLS issues,
                            from the Settings page.
                        </>
                        : <>
                            Pro users can whitelist certificates for custom hosts, which
                            may resolve some TLS issues, and configure per-host client
                            certificates.
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
                This could be due to a connection issue, or a timeout from the server.
                It's likely that this is an intermittent issue that will be solved by retrying
                the request, or you can mock requests like this to avoid sending them upstream
                at all.
            </HeaderExplanation>
        : // 'unknown':
            <HeaderExplanation>
                It's not clear what's gone wrong here, but for some reason HTTP Toolkit
                couldn't successfully and/or securely connect to the requested server.
                This might be an intermittent issue, and may be resolved by retrying
                the request.
            </HeaderExplanation>
        }

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