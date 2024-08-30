import * as React from 'react';

import { styled, css } from '../../../styles';

import { FilterSuggestion } from '../../../model/filters/filter-matching';
import { applySuggestionToText } from '../../../model/filters/syntax-matching';

import { IconButton } from '../../common/icon-button';
import { longestPrefix } from '../../../util';

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
    color: ${p => p.isHighlighted
        ? p.theme.highlightColor
        : p.theme.mainColor
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
    white-space: pre; /* Nowrap + show spaces accurately */

    ${(p: { isHighlighted: boolean }) => p.isHighlighted && css`
        box-shadow: 0px -8px 10px -10px rgba(0,0,0,${p => p.theme.boxShadowAlpha * 2});
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
    color: ${p => p.theme.mainColor};
    box-shadow:
        inset 0px 12px 8px -10px rgba(0,0,0,${p => p.theme.boxShadowAlpha}),
        inset 0px -8px 8px -10px rgba(0,0,0,${p => p.theme.boxShadowAlpha});

    white-space: pre; /* Nowrap + show spaces accurately */
    overflow: hidden;
    text-overflow: ellipsis;
    font-style: italic;
`;

export const FilterSuggestionRow = (props: {
    suggestion: FilterSuggestion,
    query: string,
    isHighlighted: boolean,
    onDelete?: () => void
}) => {
    const { suggestion, query, isHighlighted, onDelete } = props;

    // Work out how many chars of the query are included in the showAs/value text
    // We want both - when they differ, it's a template value or similar.
    const commonText = longestPrefix(
        query.slice(suggestion.index),
        suggestion.value,
        suggestion.showAs
    );
    const partiallyMatchedChars = commonText.length;

    // If there is overlap, treat the existing+suggested chars as just existing text
    const existingText = query.slice(0, suggestion.index + partiallyMatchedChars);
    const suggestedAddition = suggestion.showAs.slice(partiallyMatchedChars);

    const filterDescription = `Match ${suggestion.filterClass.filterDescription(
        applySuggestionToText(query, suggestion),
        suggestion.matchType === 'template'
    ) }`;

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
            <SuggestionDescription title={filterDescription}>
                { filterDescription }
            </SuggestionDescription>
        }
    </SuggestionRowContainer>;
}