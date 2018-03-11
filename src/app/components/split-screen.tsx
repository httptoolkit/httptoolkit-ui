import * as React from "react";
import styled from 'styled-components';

const SplitScreenContainer = styled.div`
    display: flex;
    height: 100%;
    width: 100%;
`;

const SplitScreenElement = styled.div`
    /* Give every child exactly 1/nth of the space */
    flex: 1;
    overflow: auto;
`;

export const SplitScreen = (props: { children: JSX.Element[] }) => (
    <SplitScreenContainer>
        { 
            props.children.map((c, i) => <SplitScreenElement key={i}>{ c }</SplitScreenElement>)
        }
    </SplitScreenContainer>
);