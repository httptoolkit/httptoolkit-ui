import * as React from 'react';

import { styled, FontAwesomeIcon } from '../styles'
import { getStatusColor } from './exchange-colors';

export const StatusCode = styled((props: {
    status: undefined | number,
    message: undefined | string,
    className?: string
}) => (
    <div
        className={props.className}
        title={props.status ? props.message || undefined : 'Waiting for response...'}
    >
        {
            props.status ||
            <FontAwesomeIcon
                icon={['fal', 'spinner']}
                spin={true}
            />
        }
    </div>
))`
    font-weight: bold;

    .fa-spinner {
        padding: 6px;
    }

    color: ${props => getStatusColor(props.status)};
`;