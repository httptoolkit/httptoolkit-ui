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

const SearchFilterBox = styled.div`
    position: relative;

    &:focus-within {
        border-color: ${p => p.theme.highlightColor};
    }

    flex-grow: 1;
    padding: 2px;
    box-sizing: border-box;

    border-radius: 4px;

    border: 1px solid ${p => p.theme.containerBorder};
    box-shadow: inset 0 2px 4px 1px rgba(0, 0, 0, 0.1);
    background-color: ${p => p.theme.highlightBackground};
    color: ${p => p.theme.highlightColor};

    font-size: ${p => p.theme.textSize};

    display: flex;

    .react-autosuggest__container {
        flex-grow: 1;
        margin: 3px;

        &:not(:first-child) {
            margin-left: 0;
        }
    }
`;

const ClearSearchButton = styled(IconButton)`
    padding: 4px 10px;
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

export const SearchFilter = (props: {
    searchFilters: FilterSet,
    onSearchFiltersChanged: (filters: FilterSet) => void,
    availableFilters: FilterClass[]
    placeholder?: string
}) => {
    const boxRef = React.useRef<HTMLDivElement>(null);

    const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        const filters = props.searchFilters;
        if (filters.length <= 1) return;

        const input = event.currentTarget;
        const filterBox = boxRef.current;
        if (!filterBox) return;

        if (input.selectionStart === 0 && input.selectionEnd === 0) {
            // We're in the 0th position of the input, with no text selected, and filters to the left
            if (event.key === 'Backspace') {
                // If you delete past the start of the input, delete the last filter
                props.onSearchFiltersChanged(deleteFilterIndex(props.searchFilters, 1));
            } else if (event.key === 'ArrowLeft') {
                // If you <- past the start of the input, focus the last filter tag
                const filterTags = filterBox.querySelectorAll('.filter-tag');
                const lastFilterTag = _.last(filterTags);
                if (!lastFilterTag) return;
                (lastFilterTag as HTMLElement).focus();
            }
        }
    };

    const onFilterTagKeyDown = (filterIndex: number, event: React.KeyboardEvent<HTMLDivElement>) => {
        const filterTag = event.currentTarget;
        const filterBox = boxRef.current;
        if (!filterBox) return;

        const filterTags = Array.from(filterBox.querySelectorAll('.filter-tag'));
        const tagElementIndex = filterTags.indexOf(filterTag);

        if (event.key === 'Backspace' || event.key === 'Delete') {
            // Delete this filter
            props.onSearchFiltersChanged(deleteFilterIndex(props.searchFilters, filterIndex));
            // If we're not the last filter, React will magically shift focus to the next filter
            // for us, because we index elements by key. If we are last though, we need to shift manually
            if (filterIndex === 1) (filterBox.querySelector('input[type=text]') as HTMLElement).focus();
            event.preventDefault();
        } else if (event.key === 'ArrowLeft' && tagElementIndex >= 1) {
            // Move the focus to the previous filter tag
            const previousFilter = filterTags[tagElementIndex - 1];
            if (!previousFilter) return;
            (previousFilter as HTMLElement).focus();
        } else if (event.key === 'ArrowRight') {
            const nextFilter = (tagElementIndex < filterTags.length - 1)
                ? filterTags[tagElementIndex + 1]
                : filterBox.querySelector('input[type=text]');

            if (!nextFilter) return;

            (nextFilter as HTMLElement).focus();
            if (nextFilter instanceof HTMLInputElement) {
                nextFilter.setSelectionRange(0, 0);
                event.preventDefault();
            }
        }
    };

    const onInputChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
        props.onSearchFiltersChanged([
            new StringFilter(event.target.value),
            ...props.searchFilters.slice(1)
        ]);
    };

    const onFiltersCleared = () => {
        props.onSearchFiltersChanged([]);

        const textInput = (boxRef.current?.querySelector('input[type=text]') as HTMLElement | undefined);
        textInput?.focus();
    }

    // Note that the model stores filters in the opposite order to how they're shown in the UI.
    // Mainly just because destructuring (of types & values) only works this way round.
    const [stringFilter, ...otherFilters] = props.searchFilters;

    // The text input always edits the first (last, in the UI) filter directly as a string
    const textInputValue = stringFilter?.filter ?? '';

    return <SearchFilterBox ref={boxRef}>
        {
            otherFilters.reverse().map((f, i) =>
                <FilterTag
                    key={i}
                    filter={f}
                    onKeyDown={(e) => onFilterTagKeyDown(otherFilters.length - i, e)}
                    onDelete={() => props.onSearchFiltersChanged(
                        deleteFilter(props.searchFilters, f)
                    )}
                />
            )
        }
        <FilterInput
            type='text'
            value={textInputValue}
            onChange={onInputChanged}
            onKeyDown={onInputKeyDown}
            onFiltersChanged={props.onSearchFiltersChanged}
            placeholder={props.placeholder}
            currentFilters={props.searchFilters}
            availableFilters={props.availableFilters}
        />
        { (!!textInputValue || !!otherFilters.length) &&
            <ClearSearchButton
                title="Clear all search filters"
                icon={['fas', 'times']}
                onClick={onFiltersCleared}
            />
        }
    </SearchFilterBox>;
}