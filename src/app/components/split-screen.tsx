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

const Separator = styled.div`
    width: 6px;
    height: 100%;
    position: relative;
    background-color: #f3f4f5;
    cursor: col-resize;

    &:before {
        content: '';
        width: 2px;
        position: absolute;
        top: 0;
        bottom: 0;
        right: 2px;
        background: linear-gradient(to bottom, rgba(28,50,74,0) 0%, rgba(28,50,74,0.8) 30%, rgba(28,50,74,0.8) 70%, rgba(28,50,74,0) 100%);
    }
`;

export const SplitScreen = (props: { children: JSX.Element[] }) => (
    <SplitScreenContainer>
        { 
            props.children
            .map((c, i) => <SplitScreenElement key={i}>{ c }</SplitScreenElement>)
            .reduce((result: JSX.Element[], element: JSX.Element) => result.concat(element, <Separator/>), [])
            .slice(0, -1) // Drop the final separator
        }
    </SplitScreenContainer>
);