import * as React from 'react';

import { styled, css } from '../../styles';
import { WarningIcon } from '../../icons';

import { versionSatisfies, serverVersion, CLOSE_IN_BREAKPOINT } from '../../services/service-versions';

import { clickOnEnter } from '../component-utils';
import { Button, SecondaryButton } from '../common/inputs';
import { ExchangeHeaderCard } from './exchange-card';

const HeaderExplanation = styled.p`
    width: 100%;
    margin-bottom: 10px;
    line-height: 1.2;
`;

const HeaderButtonStyles = css`
    padding: 10px 15px;
    font-weight: bold;
    font-size: ${p => p.theme.textSize};

    margin: 10px 0 0 10px;
    align-self: stretch;
`;

const HeaderButton = styled(Button)`${HeaderButtonStyles}`;
const SecondaryHeaderButton = styled(SecondaryButton)`${HeaderButtonStyles}`;

export const ExchangeRequestBreakpointHeader = (p: {
    onResume: () => void,
    onCreateResponse: () => void,
    onClose: () => void
}) =>
    <ExchangeHeaderCard>
        <HeaderExplanation>
            <WarningIcon /> <strong>This request is paused at a breakpoint</strong>
        </HeaderExplanation>
        <HeaderExplanation>
            {
                versionSatisfies(serverVersion.value as string, CLOSE_IN_BREAKPOINT)
                ? <>
                    Edit the request and then resume to let your edited request continue to the target URL,
                    respond directly to provide a response yourself, or close to immediately end the connection.
                </>
                : <>
                    Respond directly to provide a response yourself, or edit the request as you'd like
                    and then resume to let your edited request continue to the target URL.
                </>
            }
        </HeaderExplanation>

        <SecondaryHeaderButton onClick={p.onCreateResponse} onKeyPress={clickOnEnter}>
            Respond directly
        </SecondaryHeaderButton>

        { versionSatisfies(serverVersion.value as string, CLOSE_IN_BREAKPOINT)
            ? <SecondaryHeaderButton onClick={p.onClose} onKeyPress={clickOnEnter}>
                Close
            </SecondaryHeaderButton>
            : null
        }

        <HeaderButton onClick={p.onResume} onKeyPress={clickOnEnter}>
            Resume
        </HeaderButton>
    </ExchangeHeaderCard>;

export const ExchangeResponseBreakpointHeader = (p: {
    onResume: () => void,
    onClose: () => void
}) =>
    <ExchangeHeaderCard>
        <HeaderExplanation>
            <WarningIcon /> <strong>This response is paused at a breakpoint</strong>
        </HeaderExplanation>
        <HeaderExplanation>
            {
                versionSatisfies(serverVersion.value as string, CLOSE_IN_BREAKPOINT)
                ? <>
                    Edit it as you'd like and resume to let the edited response continue back to the client,
                    or close to immediately end the connection.
                </>
                : <>
                    Edit it as you'd like, then resume to let the edited response continue back to the client.
                </>
            }
        </HeaderExplanation>

        { versionSatisfies(serverVersion.value as string, CLOSE_IN_BREAKPOINT)
            ? <SecondaryHeaderButton onClick={p.onClose} onKeyPress={clickOnEnter}>
                Close
            </SecondaryHeaderButton>
            : null
        }

        <HeaderButton onClick={p.onResume} onKeyPress={clickOnEnter}>
            Resume
        </HeaderButton>
    </ExchangeHeaderCard>;