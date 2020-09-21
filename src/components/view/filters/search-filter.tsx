import * as _ from 'lodash';
import * as React from 'react';

import { styled } from '../../../styles';

import {
    Filter,
    FilterSet,
    StringFilter
} from '../../../model/filters/search-filters';

import { IconButton } from '../../common/icon-button';
import { FilterTag } from './filter-tag';

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
`;

const SearchFilterInput = styled.input`
    flex-grow: 1;

    padding: 1px 0;
    margin: 3px;
    border: none;
    outline: none;

    background-color: ${p => p.theme.highlightBackground};
    color: ${p => p.theme.highlightColor};
    font-size: ${p => p.theme.textSize};
`;

const ClearSearchButton = styled(IconButton)`
    padding: 4px 10px;
`;

const buildFilters = (input: string): FilterSet => {
    if (input.length === 0) return [];
    else return [new StringFilter(input)];
}

const deleteFilter = (filters: FilterSet, filter: Filter): FilterSet => {
    return filters.filter((f, i) =>
        f !== filter || // Keep all except our given filter
        i === 0 // Never delete the 0th element - ensures it's always a valid FilterSet
    ) as FilterSet;
};

export const SearchFilter = (props: {
    searchFilters: FilterSet,
    onSearchFiltersChanged: (filters: FilterSet) => void,
    placeholder?: string
}) => {
    const onInputChanged = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) =>
        props.onSearchFiltersChanged(buildFilters(event.target.value))
    , [props.onSearchFiltersChanged]);

    const onFiltersCleared = React.useCallback(() =>
        props.onSearchFiltersChanged([])
    , [props.onSearchFiltersChanged]);

    // Note that the model stores filters in the opposite order to how they're shown in the UI.
    // Mainly just because destructuring (of types & values) only works this way round.
    const [stringFilter, ...otherFilters] = props.searchFilters;

    // The text input always edits the first (last, in the UI) filter directly as a string
    const textInputValue = stringFilter?.filter ?? '';

    return <SearchFilterBox>
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
        <SearchFilterInput
            value={textInputValue}
            onChange={onInputChanged}
            placeholder={props.placeholder}
            {..._.omit(props, ['searchFilters', 'onSearchFiltersChanged'])}
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