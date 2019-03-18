import * as React from 'react';
import { styled, css } from '../../styles';

import { CollapsibleCard, CollapseIcon } from '../common/card'
import { FontAwesomeIcon } from '../../icons';
import { CollapsibleSectionSummary, CollapsibleSectionBody } from '../common/collapsible-section';

export interface ExchangeCardProps {
    collapsed: boolean;
    direction?: 'left' | 'right';
    onCollapseToggled: () => void;
    children: React.ReactElement<any> | Array<React.ReactElement<any> | null>;
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

export const ExchangeCard = styled(CollapsibleCard).attrs({
    tabIndex: 0
})`
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

export const ContentLabel = styled.h2`
    text-transform: uppercase;
    opacity: 0.5;

    display: inline-block;
`;

export const ContentLabelBlock = styled(ContentLabel)`
    padding: 3px 0 11px;
    display: block;
    box-sizing: border-box;
    min-height: 31px;
`;

export const ContentMonoValue = styled.div`
    padding: 3px 0 11px;
    width: 100%;

    &:last-child {
        padding-bottom: 0;
    }

    font-family: ${p => p.theme.monoFontFamily};
    word-break: break-all;
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