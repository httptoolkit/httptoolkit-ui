import * as _ from 'lodash';
import * as React from 'react';
import * as Autosuggest from 'react-autosuggest';

import { styled } from '../../../styles';

import { FilterClass } from '../../../model/filters/search-filters';
import {
    getSuggestions,
    FilterSuggestion
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
    availableFilters: FilterClass[],
    onSuggestionSelected: (suggestion: FilterSuggestion) => void
} & Autosuggest.InputProps<any>) => {
    const [suggestions, setSuggestions] = React.useState<
        FilterSuggestion[]
    >([]);

    const updateSuggestions = (request: { value: string }) => {
        setSuggestions(
            getSuggestions(props.availableFilters, request.value)
        );
    };

    const clearSuggestions = () => {
        setSuggestions([]);
    };

    const selectSuggestion = (
        event: React.FormEvent<any>,
        data: { suggestion: FilterSuggestion }
    ) => {
        props.onSuggestionSelected(data.suggestion)
    };

    return <Autosuggest
        multiSection={false}
        suggestions={suggestions}
        onSuggestionsFetchRequested={updateSuggestions}
        onSuggestionsClearRequested={clearSuggestions}
        onSuggestionSelected={selectSuggestion}
        getSuggestionValue={() => props.value} // We effectively disable this
        renderSuggestion={Suggestion}
        renderInputComponent={renderInputField}
        renderSuggestionsContainer={renderSuggestionsBox}
        inputProps={_.omit(props, ['availableFilters', 'onSuggestionSelected'])}
    />
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