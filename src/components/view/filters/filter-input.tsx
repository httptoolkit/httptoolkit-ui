import * as _ from 'lodash';
import * as React from 'react';
import * as Autosuggest from 'react-autosuggest';
import { styled } from '../../../styles';
import { trackEvent } from '../../../tracking';

import { FilterClass, FilterSet, StringFilter } from '../../../model/filters/search-filters';
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
    value: string,
    placeholder: string,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void,

    currentFilters: FilterSet,
    availableFilters: FilterClass[],
    onFiltersChanged: (filters: FilterSet) => void,
    onFiltersConsidered: (filters: FilterSet | undefined) => void
}) => {
    const autosuggestRef = React.useRef<Autosuggest>(null);

    // React-autosuggest wants us to track state, and only update it when requested. We're going
    // to ignore that, mainly because we want more direct control to update and show the
    // suggestions more aggressively than it expects. Instead of updating on request, we useMemo
    // to update the suggestions every time the value changes:
    const suggestions = React.useMemo(() =>
        getSuggestions(props.availableFilters, props.value)
    , [props.availableFilters, props.value]);

    // Whenever a suggestion is highlighted, we fire an event with the filters that would be active if
    // the suggestion is accepted, so that the list of events can preview the result.
    const considerSuggestion = React.useCallback((data: { suggestion: FilterSuggestion | null }) => {
        // If the listbox is hidden, we should never be considering filters from it.
        const listbox = autosuggestRef.current!.input!.parentElement!.querySelector("[role='listbox']");
        const listboxShown = listbox!.children.length > 0;
        const isFullMatch = data.suggestion?.type === 'full';

        if (data.suggestion && listboxShown) {
            if (isFullMatch) {
                props.onFiltersConsidered(applySuggestionToFilters(props.currentFilters, data.suggestion));
            } else {
                // If you highlight a partial match, we show the filtered events as if you haven't
                // entered any text, so you can still conveniently see the data until you either type
                // something that's not a filter (filtering just by text), or closely match a filter
                // directly (and we filter by that instead).
                props.onFiltersConsidered([
                    new StringFilter(''),
                    ...props.currentFilters.slice(1)
                ]);
            }
        } else {
            props.onFiltersConsidered(undefined);
        }
    }, [props.onFiltersConsidered, props.currentFilters, autosuggestRef]);

    // Ephemerally track the updated suggestions, so we can detect a selection in clearSuggestions()
    // and update to show ongoing suggestions instead of hiding suggestions.
    let updatedFilters: FilterSet | undefined = undefined;

    const selectSuggestion = React.useCallback((
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
    }, [updatedFilters, props.currentFilters, props.onFiltersChanged]);

    const clearSuggestions = React.useCallback(() => {
        const autosuggest = autosuggestRef.current as any;

        if (updatedFilters && updatedFilters.length === props.currentFilters.length) {
            // If this is due to a filter update, but a new filter hasn't been created (i.e. we
            // had a partial match, for a single part) then force the suggestions to stay visible:
            autosuggest.justSelectedSuggestion = false;
            autosuggest.revealSuggestions();
            updatedFilters = undefined;
        }

        // We ignore actual requests to clear the suggestions, because we show the
        // suggestions in almost all cases anyway - we just clear selection highlighting
        autosuggest.resetHighlightedSuggestion();
        considerSuggestion({ suggestion: null });
    }, [updatedFilters, selectSuggestion, props.currentFilters.length, autosuggestRef]);

    const shouldRenderSuggestions = React.useCallback((value: string, reason: string) =>
        value.trim().length > 0 ||
        !['input-focused', 'input-changed', 'escape-pressed'].includes(reason)
    , []);

    const getSuggestionTextValue = React.useCallback((suggestion: FilterSuggestion) =>
        applySuggestionToText(props.value, suggestion)
    , [props.value]);

    const inputProps = React.useMemo(() => ({
        type: 'text',
        value: props.value,
        onChange: props.onChange,
        onKeyDown: props.onKeyDown,
        placeholder: props.placeholder,
    }), [props.value, props.onChange, props.onKeyDown, props.placeholder]);

    return <Autosuggest
        ref={autosuggestRef}
        multiSection={false}
        suggestions={suggestions}
        highlightFirstSuggestion={true}
        shouldRenderSuggestions={shouldRenderSuggestions}
        onSuggestionsFetchRequested={_.noop} // No-op: we useMemo to keep suggestion up to date manually
        onSuggestionsClearRequested={clearSuggestions}
        onSuggestionHighlighted={considerSuggestion}
        onSuggestionSelected={selectSuggestion}
        getSuggestionValue={getSuggestionTextValue}
        renderSuggestion={FilterSuggestionRow}
        renderInputComponent={renderInputField}
        renderSuggestionsContainer={renderSuggestionsBox}
        inputProps={inputProps}
    />;
};