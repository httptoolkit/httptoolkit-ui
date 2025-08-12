import * as React from 'react';
import { observer } from 'mobx-react';

import { styled } from '../../styles';
import { PaneOuterContainer } from './view-details-pane';

interface MultiSelectionPanelProps {
    className?: string;
    selectedCount: number;
}

const MultiSelectionContent = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 20px;
    text-align: center;
    color: ${p => p.theme.mainColor};
    background-color: ${p => p.theme.mainBackground};
`;

const SelectionCountText = styled.h2`
    font-size: 2em;
    font-weight: bold;
    margin: 0 0 10px 0;
    color: ${p => p.theme.popColor};
`;

const SelectionDescription = styled.p`
    font-size: 1.2em;
    margin: 0;
    opacity: 0.7;
`;

export const MultiSelectionPanel = observer(({ className, selectedCount }: MultiSelectionPanelProps) => {
    return (
        <PaneOuterContainer className={className}>
            <MultiSelectionContent>
                <SelectionCountText>
                    {selectedCount}
                </SelectionCountText>
                <SelectionDescription>
                    {selectedCount === 1 ? 'event selected' : 'events selected'}
                </SelectionDescription>
            </MultiSelectionContent>
        </PaneOuterContainer>
    );
});