import { styled, css } from '../../styles';

import { CollapsibleCard, CollapseIcon } from '../common/card'

// Bit of redundancy here, but just because the TS styled plugin
// gets super confused if you use variables in property names.
const cardDirectionCss = (direction: string) => direction === 'right' ? css`
    padding-right: 15px;
    border-right: solid 5px ${p => p.theme.containerBorder};
` : css`
    padding-left: 15px;
    border-left: solid 5px ${p => p.theme.containerBorder};
`;

export const ExchangeCard = styled(CollapsibleCard).attrs({
    tabIndex: 0
})`
    word-break: break-all;

    margin-bottom: 20px;
    transition: margin-bottom 0.1s;

    ${p => p.collapsed && css`
        :not(:last-child) {
            margin-bottom: -16px;
        }
    `}

    ${(p: { direction: 'left' | 'right' }) => cardDirectionCss(p.direction)};

    &:focus {
        ${CollapseIcon} {
            color: ${p => p.theme.popColor};
        }
    }

    &:focus-within {
        header h1 {
            color: ${p => p.theme.popColor};
        }

        outline: none;
        border-color: ${p => p.theme.popColor};
    }
`;