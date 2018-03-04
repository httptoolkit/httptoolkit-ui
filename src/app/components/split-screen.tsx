import * as React from "react";
import styled from 'styled-components';

export const SplitScreen = styled.div`
    display: flex;

    > * {
        /* Give every child exactly 1/nth of the space */
        flex-grow: 1;
        flex-basis: 0;
    }
`;