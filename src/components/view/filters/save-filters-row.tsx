import * as React from 'react';

import { styled, css } from '../../../styles';
import { Icon } from '../../../icons';

export type SaveFiltersSuggestion = {
    saveFilters: true,
    filterCount: number,
    isPaidUser: boolean
};

export const isSaveFiltersSuggestion = (suggestion: any): suggestion is SaveFiltersSuggestion =>
        'saveFilters' in suggestion && suggestion.saveFilters === true;

const SaveFiltersContainer = styled.div<{ isHighlighted: boolean }>`
    background-color: ${p => p.isHighlighted
        ? p.theme.highlightBackground
        : p.theme.mainBackground
    };

    :not(:first-child) {
        border-top: 1px solid ${p => p.theme.containerBorder};
    }

    ${(p: { isHighlighted: boolean }) => p.isHighlighted && css`
        box-shadow: 0px -8px 10px -10px rgba(0,0,0,${p => p.theme.boxShadowAlpha * 2});
        font-weight: bold;
    `}

    width: 100%;
    cursor: pointer;

    padding: 8px;
    box-sizing: border-box;

    font-size: ${p => p.theme.textSize};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    svg {
        margin-right: 5px;
    }
`;

export const SaveFiltersRow = (props: {
    filterCount: number,
    query: string,
    isHighlighted: boolean,
    isPaidUser: boolean
}) => {
    return <SaveFiltersContainer isHighlighted={props.isHighlighted}>
        {
            props.isPaidUser
            ? <>
                <Icon icon={['fas', 'save']} />
                Save {
                    props.filterCount > 1
                    ? `these ${props.filterCount} filters`
                    : 'this filter'
                } as { `'${props.query}'` || '...' }
            </>
            : <>
                <Icon icon={['far', 'star']} />
                Get Pro to save {
                    props.filterCount > 1
                    ? `these ${props.filterCount} filters`
                    : 'this filter'
                } as { `'${props.query}'` || '...' }
            </>
        }
    </SaveFiltersContainer>
}