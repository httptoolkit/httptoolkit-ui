import * as _ from 'lodash';
import * as React from 'react';
import * as Autosuggest from 'react-autosuggest';
import { styled } from '../../../styles';
import { trackEvent } from '../../../tracking';

import { FilterClass, FilterSet } from '../../../model/filters/search-filters';
import {
    getSuggestions,
    FilterSuggestion,
    applySuggestionToFilters,
    applySuggestionToText
} from '../../../model/filters/filter-matching';

import { FilterSuggestionRow } from './filter-suggestion-row';

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
    z-index: 1;

    background-color: ${p => p.theme.mainBackground};
    border: 1px solid ${p => p.theme.containerBorder};
    box-shadow: 0 2px 4px 0 rgba(0,0,0,0.2);

    border-radius: 4px;
    .react-autosuggest__suggestion:first-child > * {
        border-radius: 4px 4px 0 0;
    }
    .react-autosuggest__suggestion:last-child > *, .react-autosuggest__suggestion:last-child > * > * {
        border-radius: 0 0 4px 4px;
    }
    .react-autosuggest__suggestion:first-child:last-child > * {
        border-radius: 4px;
    }

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

    // React-autosuggest wants us to track state, and only update it when requested. We're going
    // to ignore that, mainly because we want more direct control to update and show the
    // suggestions more aggressively than it expects. Instead of updating on request, we useMemo
    // to update the suggestions every time the value changes:
    const suggestions = React.useMemo(() =>
        getSuggestions(props.availableFilters, props.value)
    , [props.availableFilters, props.value]);

    // Ephemerally track the updated suggestions, so we can detect a selection in clearSuggestions()
    // and update to show ongoing suggestions instead of hiding suggestions.
    let updatedFilters: FilterSet | undefined = undefined;

    const selectSuggestion = (
        event: React.FormEvent<any>,
        data: { suggestion: FilterSuggestion }
    ) => {
        updatedFilters = applySuggestionToFilters(props.currentFilters, data.suggestion);
        trackEvent({
            category: 'Filters',
            action: 'Create',
            label: data.suggestion.filterClass.name // Track most used filters, *not* input or params
        });
        props.onFiltersChanged(updatedFilters);
    };

    const clearSuggestions = () => {
        if (updatedFilters && updatedFilters.length === props.currentFilters.length) {
            // If this is due to a filter update, but a new filter hasn't been created (i.e. we
            // had a partial match, for a single part) then force the suggestions to stay visible:
            const autosuggest = autosuggestRef.current as any;
            autosuggest.justSelectedSuggestion = false;
            autosuggest.revealSuggestions();
            updatedFilters = undefined;
        }
        // We ignore actual requests to clear the suggestions, because we show the
        // suggestions in almost all cases anyway.
    };

    const shouldRenderSuggestions = (value: string, reason: string) =>
        value.trim().length > 0 ||
        (reason !== 'input-focused' && reason !== 'input-changed');

    const getSuggestionTextValue = (suggestion: FilterSuggestion) =>
        applySuggestionToText(props.value, suggestion);

    return <Autosuggest
        ref={autosuggestRef}
        multiSection={false}
        suggestions={suggestions}
        highlightFirstSuggestion={true}
        shouldRenderSuggestions={shouldRenderSuggestions}
        onSuggestionsFetchRequested={_.noop} // No-op: we useMemo to keep suggestion up to date manually
        onSuggestionsClearRequested={clearSuggestions}
        onSuggestionSelected={selectSuggestion}
        getSuggestionValue={getSuggestionTextValue}
        renderSuggestion={FilterSuggestionRow}
        renderInputComponent={renderInputField}
        renderSuggestionsContainer={renderSuggestionsBox}
        inputProps={_.omit(props, ['currentFilters', 'availableFilters', 'onFiltersChanged'])}
    />;
};