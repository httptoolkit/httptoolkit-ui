import * as React from 'react';
import styled from 'styled-components';
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

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
    color: ${props => {
        if (!props.status || props.status < 100 || props.status >= 600) {
            // All odd undefined/unknown cases
            return '#000';
        } else if (props.status >= 500) {
            return '#ce3939';
        } else if (props.status >= 400) {
            return '#ce3939';
        } else if (props.status >= 300) {
            return '#ffc107';
        } else if (props.status >= 200) {
            return '#4caf7d';
        } else if (props.status >= 100) {
            return '#888';
        }
    }};
`;