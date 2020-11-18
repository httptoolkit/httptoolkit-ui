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
    height: 100%;

    padding: 3px 0 4px 1px;
    border: none;
    outline: none;

    background-color: ${p => p.theme.highlightBackground};
    color: ${p => p.theme.highlightColor};
    font-size: ${p => p.theme.textSize};

    ::placeholder {
        /*
        For some reason, I think related to react-split-pane setting 'user-select: text',
        the placeholder gets selected by selection.selectAllChildren. This stops that:
        */
        user-select: none;
    }
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

const areSuggestionsVisible = (autosuggestRef: React.RefObject<Autosuggest>) => {
    const autosuggestRoot = autosuggestRef.current?.input?.parentElement;
    const listbox = autosuggestRoot?.querySelector("[role='listbox']");
    return (listbox?.children.length || 0) > 0;
};

export const FilterInput = <T extends unknown>(props: {
    value: string,
    placeholder: string,
    searchInputRef?: React.Ref<HTMLInputElement>,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void,

    activeFilters: FilterSet,
    availableFilters: FilterClass<T>[],
    suggestionContext?: T,

    onFiltersChanged: (filters: FilterSet) => void,
    onFiltersConsidered: (filters: FilterSet | undefined) => void
}) => {
    const autosuggestRef = React.useRef<Autosuggest>(null);

    // React-autosuggest wants us to track state, and only update it when requested. We're going
    // to ignore that, mainly because we want more direct control to update and show the
    // suggestions more aggressively than it expects. Instead of updating on request, we useMemo
    // to update the suggestions every time the value changes:
    const suggestions = React.useMemo(() =>
        getSuggestions(props.availableFilters, props.value, props.suggestionContext)
    , [props.availableFilters, props.value, props.suggestionContext]);

    // Whenever a suggestion is highlighted, we fire an event with the filters that would be active if
    // the suggestion is accepted, so that the list of events can preview the result.
    const considerSuggestion = React.useCallback((data: { suggestion: FilterSuggestion | null }) => {
        const isFullMatch = data.suggestion?.type === 'full';

        if (data.suggestion && areSuggestionsVisible(autosuggestRef)) {
            if (isFullMatch) {
                props.onFiltersConsidered(applySuggestionToFilters(props.activeFilters, data.suggestion));
            } else {
                // If you highlight a partial match, we show the filtered events as if you haven't
                // entered any text, so you can still conveniently see the data until you either type
                // something that's not a filter (filtering just by text), or closely match a filter
                // directly (and we filter by that instead).
                props.onFiltersConsidered([
                    new StringFilter(''),
                    ...props.activeFilters.slice(1)
                ]);
            }
        } else {
            props.onFiltersConsidered(undefined);
        }
    }, [props.onFiltersConsidered, props.activeFilters, autosuggestRef]);

    // Ephemerally track the updated suggestions, so we can detect a selection in clearSuggestions()
    // and update to show ongoing suggestions instead of hiding suggestions.
    let updatedFilters: FilterSet | undefined = undefined;

    const selectSuggestion = React.useCallback((
        event: React.FormEvent<any>,
        data: { suggestion: FilterSuggestion }
    ) => {
        // Due to some race conditions, it's possible that react-autocsuggest can think we have a
        // suggestion selected even when none is shown. Guard against that.
        if (!areSuggestionsVisible(autosuggestRef)) return;

        updatedFilters = applySuggestionToFilters(props.activeFilters, data.suggestion);
        trackEvent({
            category: 'Filters',
            action: 'Create',
            label: data.suggestion.filterClass.name // Track most used filters, *not* input or params
        });
        props.onFiltersChanged(updatedFilters);
    }, [updatedFilters, props.activeFilters, props.onFiltersChanged]);

    const clearSuggestions = React.useCallback(() => {
        const autosuggest = autosuggestRef.current as any;

        if (updatedFilters && updatedFilters.length === props.activeFilters.length) {
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
    }, [updatedFilters, selectSuggestion, props.activeFilters.length, autosuggestRef]);

    const shouldRenderSuggestions = React.useCallback((value: string, reason: string) =>
        value.trim().length > 0 ||
        !['input-focused', 'input-changed', 'escape-pressed'].includes(reason)
    , []);

    const getSuggestionTextValue = React.useCallback((suggestion: FilterSuggestion) =>
        applySuggestionToText(props.value, suggestion)
    , [props.value]);

    const onInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        // React-autosuggest tries to update the input content to match the highlighted value.
        // We don't want that, so we ignore changes where the input itself hasn't changed:
        if (e.target.value === props.value) return;
        else props.onChange(e);
    }, [props.onChange, props.value]);

    const inputProps = React.useMemo(() => ({
        type: 'text',
        value: props.value,
        onChange: onInputChange,
        placeholder: props.placeholder,
        ref: props.searchInputRef
    }), [props.value, onInputChange, props.placeholder, props.searchInputRef]);

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