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
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
`;

const ResumeButton = styled(Button)`
    padding: 10px 24px;
    font-weight: bold;
    font-size: ${p => p.theme.textSize};

    margin-left: 10px;
`;

export const ExchangeBreakpointHeader = (p: {
    type: 'request' | 'response'
    onResume: () => void
}) =>
    <BreakpointHeaderCard>
        <p>
            This { p.type } is paused at a breakpoint. Edit it below as you'd like,
            then resume to let the edited {p.type} continue as normal.
        </p>

        <ResumeButton onClick={p.onResume} onKeyPress={clickOnEnter}>
            Resume
        </ResumeButton>
    </BreakpointHeaderCard>;