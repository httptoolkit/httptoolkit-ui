import * as React from 'react';

import { styled, css } from '../../styles';
import { Icon } from '../../icons';

import {
    CollapsibleCard,
    CollapsibleCardProps,
    MediumCard
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
    overflow: visible;
`;

export const LoadingCardContent = styled((props: { height?: string, className?: string }) =>
    <div className={props.className}>
        <Icon spin icon={['fac', 'spinner-arc']} size='8x' />
    </div>
)`
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
        <LoadingCardContent height={props.height} />
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

export const ExchangeHeaderCard = styled(MediumCard)`
    position: sticky;
    top: -10px;
    z-index: 2;

    margin-bottom: 20px;

    display: flex;
    flex-wrap: wrap;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;

    flex-shrink: 0;
`;