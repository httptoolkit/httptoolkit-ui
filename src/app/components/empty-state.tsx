import * as React from 'react';
import styled from 'styled-components';
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

export const EmptyState = styled((props: {
    className?: string,
    message: string,
    icon: string[],
    spin?: boolean
}) => (
    <div className={props.className}>
        <FontAwesomeIcon icon={props.icon} spin={props.spin} />
        <br/>
        { props.message }
    </div>
))`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;

    color: rgba(255, 255, 255, 0.2);
    font-size: 40px;
    text-align: center;

    margin: 0 40px;

    > svg {
        font-size: 150px;
    }
`;