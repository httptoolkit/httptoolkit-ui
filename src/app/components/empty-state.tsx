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

    color: ${props => props.theme.containerWatermark};
    font-size: 40px;
    text-align: center;

    box-sizing: border-box;
    padding: 40px;
    height: 100%;
    width: 100%;

    > svg {
        font-size: 150px;
    }
`;