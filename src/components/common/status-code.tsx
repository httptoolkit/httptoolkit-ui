import * as React from 'react';

import { styled } from '../../styles'
import { Icon } from '../../icons';
import { getStatusColor } from '../../model/events/categorization';

export const StatusCode = styled((props: {
    status:
        | undefined // Still in progress
        | 'aborted' // Failed before response
        | 'WS:open' // Accepted active websocket
        | 'WS:closed' // Accepted but now closed websocket
        | number, // Any other status
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
            : props.status === 'WS:open'
                ? <>
                    WS <Icon
                        icon={['fas', 'spinner']}
                        spin={true}
                    />
                </>
            : props.status === 'WS:closed'
                ? 'WS'
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
    > svg {
        box-sizing: content-box;
    }

    font-weight: bold;

    display: flex;
    align-items: center;

    .fa-spinner {
        padding: 6px;
    }

    .fa-ban {
        padding: 5px;
    }

    color: ${props => getStatusColor(
        (props.status === 'WS:open' || props.status === 'WS:closed')
            ? undefined
            : props.status,
        props.theme
    )};
`;