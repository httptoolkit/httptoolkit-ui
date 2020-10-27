import * as React from 'react';

import { styled, css } from '../../../styles';

import { FilterSuggestion, applySuggestionToText } from '../../../model/filters/filter-matching';

const ExistingText = styled.span`
    font-weight: bold;
`;

const SuggestedText = styled.span`
    opacity: 0.7;
`;

const SuggestionRowContainer = styled.div<{ isHighlighted: boolean }>`
    background-color: ${p => p.isHighlighted
        ? p.theme.highlightBackground
        : p.theme.mainBackground
    };

    ${p => p.isHighlighted && css`
        ${SuggestedText} {
            opacity: 1;
        }
    `}

    width: 100%;
    cursor: pointer;

    font-size: ${p => p.theme.textSize};
`;

const SuggestionRowPart = styled.p`
    padding: 8px;
`;

const SuggestionDetails = styled(SuggestionRowPart)`
    ${(p: { isHighlighted: boolean }) => p.isHighlighted && css`
        box-shadow: 0px -8px 10px -10px rgba(0,0,0,0.3);
    `}
`;

const SuggestionDescription = styled(SuggestionRowPart)`
    background-color: ${p => p.theme.mainLowlightBackground};
    box-shadow:
        inset 0px 12px 8px -10px rgba(0,0,0,0.15),
        inset 0px -8px 8px -10px rgba(0,0,0,0.15);

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

export const FilterSuggestionRow = (filterSuggestion: FilterSuggestion, params: {
    query: string,
    isHighlighted: boolean
}) => {
    const { query } = params;

    // Work out how many chars of the query are included in the showAs text
    const partiallyMatchedChars = filterSuggestion.value === filterSuggestion.showAs
        ? Math.min(
            params.query.length - filterSuggestion.index,
            filterSuggestion.showAs.length // A filter may be shorter than the input!
        )
        : 0;

    // If there is overlap, treat the existing+suggested chars as just existing text
    const existingText = query.slice(0, filterSuggestion.index + partiallyMatchedChars);
    const suggestedAddition = filterSuggestion.showAs.slice(partiallyMatchedChars);

    return <SuggestionRowContainer isHighlighted={params.isHighlighted}>
        <SuggestionDetails isHighlighted={params.isHighlighted}>
            <ExistingText>{ existingText }</ExistingText>
            <SuggestedText>{ suggestedAddition }</SuggestedText>
        </SuggestionDetails>
        { params.isHighlighted && <SuggestionDescription>
            { filterSuggestion.filterClass.filterDescription(applySuggestionToText(query, filterSuggestion)) }
        </SuggestionDescription> }
    </SuggestionRowContainer>;
}