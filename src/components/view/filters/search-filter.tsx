import * as _ from 'lodash';
import * as React from 'react';

import { styled } from '../../../styles';

import {
    Filter,
    StringFilter
} from '../../../model/filters/search-filters';

import { SearchBox } from '../../common/search-box';

const SearchFilterBox = styled(SearchBox)`
    flex-basis: 60%;

    > input {
        font-size: ${p => p.theme.textSize};
        padding: 5px 12px;
    }
`;

const buildFilters = (input: string): Filter[] => {
    if (input.length === 0) return [];
    else return [new StringFilter(input)];
}

export const SearchFilter = (props: {
    searchFilters: Filter[],
    onSearchFiltersChanged: (filters: Filter[]) => void
} & React.ComponentProps<typeof SearchFilterBox>) => {
    const onInputChanged = React.useCallback((input: string) =>
        props.onSearchFiltersChanged(buildFilters(input))
    , [props.onSearchFiltersChanged]);

    // Live text always edits the final string filter directly
    const stringFilter = props.searchFilters[props.searchFilters.length - 1] as
        StringFilter | undefined;

    return <SearchFilterBox
        value={stringFilter?.filter ?? ''}
        onSearch={onInputChanged}
        {..._.omit(props, ['searchFilters', 'onSearchFiltersChanged'])}
    />;
}