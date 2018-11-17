import * as React from 'react';

import { styled } from '../../styles'
import { FontAwesomeIcon } from '../../icons';
import { getStatusColor } from '../../exchange-colors';

export const StatusCode = styled((props: {
    status: undefined | 'aborted' | number,
    message: undefined | string,
    className?: string
}) => (
    <div
        className={props.className}
        title={!props.status ? 'Waiting for response...' : (props.message || undefined) }
    >
        {
            props.status === 'aborted' ?
                <FontAwesomeIcon icon={['far', 'ban']} />
            : (
                props.status ||
                <FontAwesomeIcon
                    icon={['fal', 'spinner']}
                    spin={true}
                />
            )
        }
    </div>
))`
    font-weight: bold;

    .fa-spinner {
        padding: 6px;
    }

    .fa-ban {
        padding: 5px;
    }

    color: ${props => getStatusColor(props.status)};
`;