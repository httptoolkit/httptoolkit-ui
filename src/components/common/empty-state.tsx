import * as React from 'react';
import * as _ from 'lodash';

import { styled } from '../../styles'
import { Icon, IconProp } from '../../icons';

export const EmptyState = styled((props: React.HTMLAttributes<HTMLDivElement> & {
    className?: string,
    icon: IconProp,
    spin?: true | 'slow',
    children?: React.ReactNode
}) => (
    <div {..._.omit(props, ['message', 'icon', 'spin'])}>
        <Icon
            icon={props.icon}
            spin={props.spin === true}
            className={props.spin === 'slow' ? 'slow-spin' : undefined}
        />
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

    color: ${props => props.theme.containerWatermark};
    font-size: 40px;
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