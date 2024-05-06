import * as React from 'react';
import * as _ from 'lodash';

import { styled } from '../../styles'
import { IconKey, PhosphorIcon } from '../../icons';

export const EmptyState = styled((props: React.HTMLAttributes<HTMLDivElement> & {
    className?: string,
    icon: IconKey,
    children?: React.ReactNode
}) => (
    <div className={props.className}>
        <PhosphorIcon icon={props.icon} />
        { props.children && <>
            <br/>
            { props.children }
        </> }
    </div>
))`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    color: ${p => p.theme.containerWatermark};
    font-size: ${p => p.theme.loudHeadingSize};
    letter-spacing: -1px;

    text-align: center;

    box-sizing: border-box;
    padding: 20px;
    height: 100%;
    width: 100%;

    margin: auto 0;

    > svg {
        font-size: 150px;
    }
`;