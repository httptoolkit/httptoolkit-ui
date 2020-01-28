import * as React from 'react';

import { styled } from '../../styles'
import { Icon } from '../../icons';
import { getStatusColor } from '../../model/http/exchange-colors';

export const StatusCode = styled((props: {
    status: undefined | 'aborted' | number,
    message?: string,
    className?: string
}) => (
    <div
        className={props.className}
        title={!props.status ? 'Waiting for response...' : (props.message || undefined) }
    >
        {
            props.status === 'aborted' ?
                <Icon icon={['fas', 'ban']} />
            : (
                props.status ||
                <Icon
                    icon={['fas', 'spinner']}
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

    color: ${props => getStatusColor(props.status, props.theme)};
`;