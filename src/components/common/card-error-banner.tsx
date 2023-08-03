
import { styled } from '../../styles';

import { Content } from './text-content';

export const CardErrorBanner = styled(Content)<{
    direction?: 'left' | 'right'
}>`
    ${p => p.direction === 'left'
            ? 'margin: 0 -20px 0 -15px;'
        : p.direction === 'right'
            ? 'margin: 0 -15px 0 -20px;'
        : 'margin: 0 -20px 0 -20px;'
    }

    padding: 10px 30px 0;

    font-size: ${p => p.theme.textSize};
    color: ${p => p.theme.mainColor};
    background-color: ${p => p.theme.warningBackground};
    border-top: solid 1px ${p => p.theme.containerBorder};

    svg {
        margin-left: 0;
    }
`;