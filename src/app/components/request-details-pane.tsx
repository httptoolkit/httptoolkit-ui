import * as React from "react";
import styled from 'styled-components';
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { MockttpRequest } from "../types";
import { EmptyState } from './empty-state';

export const RequestDetailsPane = styled((props: {
    className?: string,
    selected: MockttpRequest[]
}) =>
    <div className={props.className}>{
        props.selected.length === 0 ?
            <EmptyState
                icon={['far', 'arrow-left']}
                message='Select some requests to see their details.'
            />
            : null
    }</div>
)`
    height: 100%;
`;