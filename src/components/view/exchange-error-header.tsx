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

export const ExchangeErrorHeader = (p: {
    isPaidUser: boolean,
    type:
        | 'untrusted'
        | 'expired'
        | 'wrong-host'
        | 'tls-error'
        | 'host-not-found',
    getPro: () => void,
    navigate: (path: string) => void,
    ignoreError: () => void
}) =>
    <ExchangeHeaderCard>
        <HeaderExplanation>
            <WarningIcon /> <strong>This request was not forwarded successfully</strong>
        </HeaderExplanation>

        <HeaderExplanation>
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
                    ? 'hostname could not found'
                : 'failed to communicate, due to an unknown error'
            }, so HTTP Toolkit did not forward the request.
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
            : <HeaderExplanation>
                By default this is only allowed for localhost servers, but {
                    p.isPaidUser
                        ? 'other hosts can be added to the whitelist from the Settings page.'
                        : 'Pro users can whitelist other custom hosts.'
                }
            </HeaderExplanation>
        }

        <HeaderButton onClick={p.ignoreError} onKeyPress={clickOnEnter}>
            Ignore
        </HeaderButton>

        { p.type ==='host-not-found'
            ? <HeaderButton onClick={() => p.navigate('/mock')} onKeyPress={clickOnEnter}>
                Go to the Mock page
            </HeaderButton>
            : p.isPaidUser
                ? <HeaderButton onClick={() => p.navigate('/settings')} onKeyPress={clickOnEnter}>
                    Go to Settings
                </HeaderButton>
            : <HeaderButton onClick={p.getPro} onKeyPress={clickOnEnter}>
                Get Pro
            </HeaderButton>
        }

    </ExchangeHeaderCard>;
