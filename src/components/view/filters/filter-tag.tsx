import * as React from 'react';
import * as polished from 'polished';

import { styled } from '../../../styles';
import { Icon } from '../../../icons';

import { Filter } from '../../../model/filters/search-filters';

const FilterTagDelete = styled(Icon).attrs(() => ({
    icon: ['fas', 'times']
}))`
    position: absolute;
    right: -20px;
    top: 50%;
    transform: translateY(-50%);
    transition: right 0.1s;
    cursor: pointer;

    padding: 6px;
    background-image: radial-gradient(
        ${p => polished.rgba(p.theme.mainBackground, 0.9)} 50%,
        transparent 100%
    );

    &:hover {
        color: ${p => p.theme.popColor};
    }
`;

const FilterTagName = styled.span`
    white-space: pre; /* Nowrap + show spaces accurately */
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 4px;
`

const FilterTagContainer = styled.div`
    flex-shrink: 0;

    display: flex;
    align-items: center;

    position: relative;
    overflow: hidden;

    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;

    margin-right: 5px;

    background-color: ${p => p.theme.mainBackground};
    color: ${p => p.theme.mainColor};

    border: 1px solid ${p => p.theme.containerWatermark};
    box-shadow: 0 2px 4px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha});
    border-radius: 3px;

    cursor: pointer;

    &:hover, &:focus-within {
        box-shadow: 0 2px 4px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha * 2});
    }

    &:hover {
        > ${FilterTagDelete} {
            right: 0;
        }
    }

    &:focus-within {
        outline: none;
        border-color: ${p => p.theme.popColor};
    }

    &.is-selected {
        background-color: ${p => p.theme.mainLowlightBackground};
        box-shadow: inset 0 0 12px -8px #000;
    }

    & ::selection {
        background-color: transparent;
    }
`;

function ignoreTripleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.detail === 3) event.preventDefault();
}

export const FilterTag = React.forwardRef((props: {
    filter: Filter,
    isSelected: boolean,
    onDelete: () => void
    onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void
}, ref: React.Ref<HTMLDivElement>) => {
    return <FilterTagContainer
        ref={ref}
        className={'filter-tag' + (props.isSelected ? ' is-selected' : '')}
        tabIndex={-1}
        onKeyDown={props.onKeyDown}
        onMouseDown={ignoreTripleClick}
        title={`Match ${props.filter.filterDescription}`}
    >
        <FilterTagName>{ props.filter.toString() }</FilterTagName>
        <FilterTagDelete onClick={props.onDelete} />
    </FilterTagContainer>;
});