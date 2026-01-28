import * as React from 'react';

import { styled } from '../../styles';

export const PaneOuterContainer = styled.div`
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
`;

const PaneScrollOuterContainer = styled.div`
    position: relative;
    overflow-y: scroll;

    flex-grow: 1;
    padding: 0 20px 0 20px;

    background-color: ${p => p.theme.containerBackground};

    container-type: size;
`;

const PaneScrollInnerContainer = styled.div`
    min-height: 100%;
    box-sizing: border-box;

    display: flex;
    flex-direction: column;

    /*
    * This padding could be padding on the scroll container, but doing so causes odd
    * behaviour where position: sticky headers don't take it into account, on OSX only.
    * Moving to the direct parent of the header makes that consistent, for some reason. Ew.
    */
    padding-top: 20px;
`;

export const PaneScrollContainer = (p: { children: React.ReactNode }) =>
    <PaneScrollOuterContainer>
        <PaneScrollInnerContainer>
            { p.children }
        </PaneScrollInnerContainer>
    </PaneScrollOuterContainer>;