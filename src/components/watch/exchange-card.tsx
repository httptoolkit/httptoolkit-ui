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

export const ExchangeCard = styled(CollapsibleCard)`
    margin: 20px;
    word-break: break-all;

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