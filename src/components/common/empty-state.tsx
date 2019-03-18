import * as React from 'react';
import * as _ from 'lodash';

import { styled } from '../../styles'
import { FontAwesomeIcon } from '../../icons';

export const EmptyState = styled((props: React.HTMLAttributes<HTMLDivElement> & {
    className?: string,
    icon: string[],
    spin?: true | 'slow',
    message?: string
}) => (
    <div {..._.omit(props, ['message', 'icon', 'spin'])}>
        <FontAwesomeIcon
            icon={props.icon}
            spin={props.spin === true}
            className={props.spin === 'slow' ? 'slow-spin' : undefined}
        />
        { props.message && <>
            <br/>
            { props.message }
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
    padding: 40px;
    height: 100%;
    width: 100%;

    margin: auto 0;

    > svg {
        font-size: 150px;
    }
`;