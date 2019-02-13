import * as React from 'react';
import { styled, css } from '../../styles';

import { CollapsibleCard, CollapseIcon } from '../common/card'
import { FontAwesomeIcon } from '../../icons';

export interface ExchangeCardProps {
    collapsed: boolean;
    direction: 'left' | 'right';
    onCollapseToggled: () => void;
    children: React.ReactElement<any> | React.ReactElement<any>[];
}

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

    ${(p: ExchangeCardProps) => cardDirectionCss(p.direction)};

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

const LoadingCardContent = styled.div<{ height?: string }>`
    ${p => p.height && css`
        height: ${p.height};
    `}

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
`;

export const LoadingExchangeCard = (props:
    ExchangeCardProps & { height?: string }
) =>
    <ExchangeCard {...props}>
        <header>
            { props.children }
        </header>
        <LoadingCardContent height={props.height}>
            <FontAwesomeIcon spin icon={['fac', 'spinner-arc']} size='8x' />
        </LoadingCardContent>
    </ExchangeCard>;