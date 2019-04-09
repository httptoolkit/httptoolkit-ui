import * as React from 'react';

import { styled, css } from '../../styles';
import { FontAwesomeIcon } from '../../icons';

import {
    CollapsibleCard,
    CollapseIcon,
    CollapsibleCardProps
} from '../common/card'
import {
    CollapsibleSectionSummary,
    CollapsibleSectionBody
} from '../common/collapsible-section';

export interface ExchangeCardProps extends CollapsibleCardProps {
    direction?: 'left' | 'right';
}

// Bit of redundancy here, but just because the TS styled plugin
// gets super confused if you use variables in property names.
const cardDirectionCss = (direction?: string) =>
    direction === 'right' ? css`
        padding-right: 15px;
        border-right: solid 5px ${p => p.theme.containerBorder};
    ` :
    direction === 'left' ? css`
        padding-left: 15px;
        border-left: solid 5px ${p => p.theme.containerBorder};
    ` : '';

export const ExchangeCard = styled(CollapsibleCard)`
    ${(p: ExchangeCardProps) => cardDirectionCss(p.direction)};
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

export const ExchangeCollapsibleBody = styled(CollapsibleSectionBody)`
    margin-left: -20px;
    margin-right: -20px;
    padding-left: 20px;
    padding-right: 20px;
`;

export const ExchangeCollapsibleSummary = styled(CollapsibleSectionSummary)`
    margin-left: -20px;
    padding-left: 20px;
`;