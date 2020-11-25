import * as React from 'react';

import { styled, css } from '../../../styles';

import {
    FilterSuggestion,
    applySuggestionToText
} from '../../../model/filters/filter-matching';

import { IconButton } from '../../common/icon-button';

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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    ${(p: { isHighlighted: boolean }) => p.isHighlighted && css`
        box-shadow: 0px -8px 10px -10px rgba(0,0,0,0.3);
    `}

    svg {
        margin-left: auto;
    }
`;

const SuggestionDeleteButton = styled(IconButton).attrs(() => ({
    icon: ['far', 'trash-alt']
}))`
    float: right;
    padding: 4px;
    margin: -4px -4px;
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

export const FilterSuggestionRow = (props: {
    suggestion: FilterSuggestion,
    query: string,
    isHighlighted: boolean,
    onDelete?: () => void
}) => {
    const { suggestion, query, isHighlighted, onDelete } = props;

    // Work out how many chars of the query are included in the showAs text
    const partiallyMatchedChars = suggestion.value === suggestion.showAs
        ? Math.min(
            query.length - suggestion.index,
            suggestion.showAs.length // A filter may be shorter than the input!
        )
        : 0;

    // If there is overlap, treat the existing+suggested chars as just existing text
    const existingText = query.slice(0, suggestion.index + partiallyMatchedChars);
    const suggestedAddition = suggestion.showAs.slice(partiallyMatchedChars);

    return <SuggestionRowContainer isHighlighted={isHighlighted}>
        <SuggestionDetails isHighlighted={isHighlighted}>
            <ExistingText>{ existingText }</ExistingText>
            <SuggestedText>{ suggestedAddition }</SuggestedText>
            { onDelete &&
                <SuggestionDeleteButton
                    title="Delete this custom filter shortcut"
                    onClick={(e) => {
                        onDelete();
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                />
            }
        </SuggestionDetails>

        { isHighlighted &&
            <SuggestionDescription>
                { suggestion.filterClass.filterDescription(
                    applySuggestionToText(query, suggestion),
                    !!suggestion.template
                ) }
            </SuggestionDescription>
        }
    </SuggestionRowContainer>;
}