import * as _ from 'lodash';
import * as React from 'react';
import * as Autosuggest from 'react-autosuggest';

import { styled } from '../../../styles';

import { Filter, FilterClass, FilterSet } from '../../../model/filters/search-filters';
import {
    getSuggestions,
    FilterSuggestion,
    applySuggestionToFilters
} from '../../../model/filters/filter-matching';

const FilterInputField = styled.input`
    box-sizing: border-box;
    width: 100%;

    padding: 1px 0;
    border: none;
    outline: none;

    background-color: ${p => p.theme.highlightBackground};
    color: ${p => p.theme.highlightColor};
    font-size: ${p => p.theme.textSize};
`;

const FilterSuggestionsBox = styled.div`
    position: absolute;
    bottom: calc(100% + 10px);
    left: 0;
    right: 0;
    padding: 8px;

    background-color: ${p => p.theme.highlightBackground};
    border: 1px solid ${p => p.theme.containerBorder};
    box-shadow: 0 2px 4px 0 rgba(0,0,0,0.2);
    border-radius: 4px;

    color: ${p => p.theme.highlightColor};
    font-size: ${p => p.theme.textSize};

    &:empty {
        display: none;
    }
`;

// Need to wrap these as functions, to make autosuggest happy:
const renderInputField = (props: any) => <FilterInputField {...props} />;
const renderSuggestionsBox = (props: { containerProps: any, children: any }) =>
    <FilterSuggestionsBox {...props.containerProps}>
        { props.children }
    </FilterSuggestionsBox>;

export const FilterInput = (props: {
    currentFilters: FilterSet,
    availableFilters: FilterClass[],
    onFiltersChanged: (filters: FilterSet) => void
} & Autosuggest.InputProps<any>) => {
    const autosuggestRef = React.useRef<Autosuggest>(null);

    const [suggestions, setSuggestions] = React.useState<
        FilterSuggestion[]
    >([]);

    const updateSuggestions = (request: { value: string }) => {
        setSuggestions(
            getSuggestions(props.availableFilters, request.value)
        );
    };

    // Ephemerally track the updated suggestions, so we can detect a selection in clearSuggestions()
    // and update to show ongoing suggestions instead of hiding suggestions.
    let updatedFilters: FilterSet | undefined = undefined;

    const selectSuggestion = (
        event: React.FormEvent<any>,
        data: { suggestion: FilterSuggestion }
    ) => {
        updatedFilters = applySuggestionToFilters(props.currentFilters, data.suggestion);
        props.onFiltersChanged(updatedFilters);
    };

    const clearSuggestions = () => {
        if (updatedFilters && updatedFilters.length === props.currentFilters.length) {
            // If this is from a filter update, but a new filter hasn't been created (i.e. we had a
            // partial match, for a single part) then keep the suggestions visible & update them:
            const autosuggest = autosuggestRef.current as any;
            updateSuggestions({ value: updatedFilters[0]?.filter || '' });
            autosuggest.justSelectedSuggestion = false;
            autosuggest.revealSuggestions();
            updatedFilters = undefined;
        } else {
            setSuggestions([]);
        }
    };

    return <Autosuggest
        ref={autosuggestRef}
        multiSection={false}
        suggestions={suggestions}
        onSuggestionsFetchRequested={updateSuggestions}
        onSuggestionsClearRequested={clearSuggestions}
        onSuggestionSelected={selectSuggestion}
        getSuggestionValue={() => props.value} // We effectively disable this
        renderSuggestion={Suggestion}
        renderInputComponent={renderInputField}
        renderSuggestionsContainer={renderSuggestionsBox}
        inputProps={_.omit(props, ['currentFilters', 'availableFilters', 'onFiltersChanged'])}
    />;
};

const SuggestionRow = styled.div<{ isHighlighted: boolean }>`
    ${p => p.isHighlighted && `
        font-weight: bold;
    `}
`;

const Suggestion = (filterSuggestion: FilterSuggestion, params: {
    query: string,
    isHighlighted: boolean
}) =>
    <SuggestionRow isHighlighted={params.isHighlighted}>
        <strong>{ params.query.slice(0, filterSuggestion.index) }</strong>{ filterSuggestion.showAs }
    </SuggestionRow>;