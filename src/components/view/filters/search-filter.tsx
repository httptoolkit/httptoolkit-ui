import * as _ from 'lodash';
import * as React from 'react';

import { styled } from '../../../styles';

import {
    Filter,
    FilterSet,
    StringFilter,
    FilterClass
} from '../../../model/filters/search-filters';

import { IconButton } from '../../common/icon-button';
import { FilterTag } from './filter-tag';
import { FilterInput } from './filter-input';

const CLEAR_BUTTON_WIDTH = '30px';

const SearchFilterBox = styled.div<{ hasContents: boolean }>`
    position: relative;

    &:focus-within {
        border-color: ${p => p.theme.highlightColor};
    }

    flex-grow: 1;
    min-width: 0; /* Don't let flexbox force this to expand given long tags */
    padding: 2px ${p => p.hasContents ? CLEAR_BUTTON_WIDTH : '2px'} 2px 2px;

    border-radius: 4px;

    border: 1px solid ${p => p.theme.containerBorder};
    box-shadow: inset 0 2px 4px 1px rgba(0, 0, 0, 0.1);
    background-color: ${p => p.theme.highlightBackground};
    color: ${p => p.theme.highlightColor};

    font-size: ${p => p.theme.textSize};

    display: flex;
    flex-wrap: wrap;

    .react-autosuggest__container {
        flex-grow: 1;
        margin: 3px 0 3px 3px;

        &:not(:first-child) {
            margin-left: 0;
        }
    }
`;

const ClearSearchButton = styled(IconButton)`
    width: ${CLEAR_BUTTON_WIDTH};
    padding: 4px 10px;
    box-sizing: border-box;

    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
`;

const deleteFilter = (filters: FilterSet, filter: Filter): FilterSet => {
    return filters.filter((f, i) =>
        f !== filter || // Keep all except our given filter
        i === 0 // Never delete the 0th element - ensures it's always a valid FilterSet
    ) as FilterSet;
};

const deleteFilterIndex = (filters: FilterSet, index: number): FilterSet => {
    if (index === 0 || filters.length === 0) return filters; // No-op, we never remove the StringFilter
    else return [
        filters[0] as StringFilter,
        ...filters.slice(1, index),
        ...filters.slice(index + 1)
    ];
};

export const SearchFilter = React.memo((props: {
    searchFilters: FilterSet,
    onSearchFiltersConsidered: (filters: FilterSet | undefined) => void,
    onSearchFiltersChanged: (filters: FilterSet) => void,
    availableFilters: FilterClass[]
    placeholder: string,
    searchInputRef?: React.Ref<HTMLInputElement>
}) => {
    const boxRef = React.useRef<HTMLDivElement>(null);

    const onKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLElement>) => {
        const filterBox = boxRef.current;
        if (!filterBox) return;

        const filterTagElements = Array.from(filterBox.querySelectorAll('.filter-tag'));
        const filterInput = filterBox.querySelector('input')!;
        const filterElements = [...filterTagElements, filterInput] as HTMLElement[];

        const focusedElement = document.activeElement;
        const focusedElementIndex = filterElements.indexOf(focusedElement as HTMLElement);
        if (focusedElementIndex === -1) return; // These key bindings apply only to the input & tags:

        if (filterInput.selectionStart === filterInput.selectionEnd) {
            // Otherwise, as long as nothing is selected in the input, we're just handling a cursor:
            const inputCursorIndex = filterInput.selectionStart ?? -1;
            const isInputSelected = focusedElement === filterInput;

            if (event.key === 'Backspace' || event.key === 'Delete') {
                // We're deleting something (or a char in the input). Remember that UI order
                // is reversed, so we map the element index to an index in the model:
                let filterIndexToDelete = !isInputSelected
                    ? filterElements.length - 1 - focusedElementIndex // Delete the selected filter
                : inputCursorIndex <= 0 && event.key === 'Backspace'
                    ? 1 // Delete back from the start of the input -> delete the first non-string filter
                : null; // We're within text in the input, do nothing (i.e. delete a char as normal)

                if (filterIndexToDelete) {
                    props.onSearchFiltersChanged(
                        deleteFilterIndex(props.searchFilters, filterIndexToDelete)
                    );

                    // If we're not the last filter tag, React will magically shift focus to the next for us,
                    // because we index elements by key. If we are last though, we need to shift manually:
                    if (filterIndexToDelete === 1) filterInput.focus();
                    event.preventDefault();
                }
            } else if (event.key === 'ArrowLeft' && focusedElementIndex > 0 && inputCursorIndex <= 0) {
                filterElements[focusedElementIndex - 1].focus();
                event.preventDefault();
            } else if (event.key === 'ArrowRight' && focusedElementIndex < filterElements.length - 1) {
                const nextFilter = filterElements[focusedElementIndex + 1];
                nextFilter.focus();
                if (nextFilter === filterInput) filterInput.setSelectionRange(0, 0);
                event.preventDefault();
            }
        }
    }, [boxRef, props.onSearchFiltersChanged, props.searchFilters]);

    const onInputChanged = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        props.onSearchFiltersChanged([
            new StringFilter(event.target.value),
            ...props.searchFilters.slice(1)
        ]);
    }, [props.onSearchFiltersChanged, props.searchFilters]);

    const onFiltersCleared = React.useCallback(() => {
        props.onSearchFiltersChanged([]);

        const textInput = (boxRef.current?.querySelector('input[type=text]') as HTMLElement | undefined);
        textInput?.focus();
    }, [props.onSearchFiltersChanged, boxRef]);

    // Note that the model stores filters in the opposite order to how they're shown in the UI.
    // Mainly just because destructuring (of types & values) only works this way round.
    const [stringFilter, ...otherFilters] = props.searchFilters;

    // The text input always edits the first (last, in the UI) filter directly as a string
    const textInputValue = stringFilter?.filter ?? '';

    const hasContents = !!textInputValue || !!otherFilters.length;

    return <SearchFilterBox
        ref={boxRef}
        hasContents={hasContents}
        onKeyDown={onKeyDown}
    >
        {
            otherFilters.reverse().map((f, i) =>
                <FilterTag
                    key={i}
                    filter={f}
                    onDelete={() => props.onSearchFiltersChanged(
                        deleteFilter(props.searchFilters, f)
                    )}
                />
            )
        }
        <FilterInput
            value={textInputValue}
            onChange={onInputChanged}
            placeholder={props.placeholder}
            searchInputRef={props.searchInputRef}

            onFiltersConsidered={props.onSearchFiltersConsidered}
            onFiltersChanged={props.onSearchFiltersChanged}
            currentFilters={props.searchFilters}
            availableFilters={props.availableFilters}
        />
        { hasContents &&
            <ClearSearchButton
                title="Clear all search filters"
                icon={['fas', 'times']}
                onClick={onFiltersCleared}
            />
        }
    </SearchFilterBox>;
});