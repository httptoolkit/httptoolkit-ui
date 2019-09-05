import * as React from 'react';

import { styled } from '../../styles';
import { clickOnEnter } from '../component-utils';
import { MediumCard } from '../common/card';
import { Button } from '../common/inputs';

const BreakpointHeaderCard = styled(MediumCard)`
    position: sticky;
    top: -25px;
    z-index: 2;

    margin-bottom: 20px;

    display: flex;
    flex-wrap: wrap;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
`;

const HeaderExplanation = styled.p`
    width: 100%;
    margin-bottom: 10px;
`;

const HeaderButton = styled(Button)`
    padding: 10px 20px;
    font-weight: bold;
    font-size: ${p => p.theme.textSize};

    margin: 10px 0 0 20px;
    align-self: stretch;
`;

export const ExchangeRequestBreakpointHeader = (p: {
    onResume: () => void,
    onCreateResponse: () => void
}) =>
    <BreakpointHeaderCard>
        <HeaderExplanation>
            <strong>This request is paused at a breakpoint.</strong>
        </HeaderExplanation>
        <HeaderExplanation>
            Edit it as you'd like, then resume to let the edited request continue as normal,
            or respond directly to provide a response yourself.
        </HeaderExplanation>

        <HeaderButton onClick={p.onCreateResponse} onKeyPress={clickOnEnter}>
            Respond directly
        </HeaderButton>

        <HeaderButton onClick={p.onResume} onKeyPress={clickOnEnter}>
            Resume
        </HeaderButton>
    </BreakpointHeaderCard>;

export const ExchangeResponseBreakpointHeader = (p: {
    onResume: () => void
}) =>
    <BreakpointHeaderCard>
        <HeaderExplanation>
            <strong>This response is paused at a breakpoint.</strong>
        </HeaderExplanation>
        <HeaderExplanation>
            Edit it as you'd like, then resume to let the edited response complete as normal.
        </HeaderExplanation>

        <HeaderButton onClick={p.onResume} onKeyPress={clickOnEnter}>
            Resume
        </HeaderButton>
    </BreakpointHeaderCard>;