import * as React from 'react';

import { styled, css } from '../../styles';
import { Icon } from '../../icons';

import {
    CollapsibleCard,
    CollapsibleCardProps
} from '../common/card'

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

export const LoadingCard = (props:
    CollapsibleCardProps & { height?: string, children?: React.ReactNode }
) => <CollapsibleCard {...props}>
    { props.children }
    <LoadingCardContent height={props.height} />
</CollapsibleCard>;