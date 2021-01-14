import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';

import { styled } from '../../styles';
import { CollectedEvent } from '../../types';

import { isHttpExchange } from '../../model/http/exchange';
import {
    FilterSet,
    SelectableSearchFilterClasses
} from '../../model/filters/search-filters';

import { ClearAllButton, ExportAsHarButton, ImportHarButton, PlayPauseButton } from './view-event-list-buttons';
import { SearchFilter } from './filters/search-filter';

export const HEADER_FOOTER_HEIGHT = 38;

const RequestCounter = styled(observer((props: {
    className?: string,
    eventCount: number,
    filteredEventCount: number
}) =>
    <div className={props.className}>
        <span className='count'>
            { props.filteredEventCount }
            { props.eventCount !== props.filteredEventCount &&
                ` / ${ props.eventCount }`
            }
        </span>
        <span className='label'>requests</span>
</div>
))`
    margin-left: auto;
    padding: 0 10px;

    display: flex;
    flex-direction: column;
    align-items: flex-end;

    .count {
        font-size: 20px;
        font-weight: bold;
        white-space: nowrap;
    }

    .label {
        margin-top: -4px;
        font-size: ${p => p.theme.textSize};
        opacity: 0.8;
        font-weight: lighter;
    }
`;


const ButtonsContainer = styled.div`
    display: flex;
`;

export const ViewEventListFooter = styled(observer((props: {
    className?: string,
    onClear: () => void,
    onFiltersConsidered: (filters: FilterSet | undefined) => void,

    allEvents: CollectedEvent[],
    filteredEvents: CollectedEvent[],

    searchInputRef?: React.Ref<HTMLInputElement>
}) => <div className={props.className}>
    <SearchFilter
        onFiltersConsidered={props.onFiltersConsidered}
        availableFilters={SelectableSearchFilterClasses}
        filterSuggestionContext={props.allEvents}
        placeholder={'Filter by method, host, headers, status...'}
        searchInputRef={props.searchInputRef}
    />
    <RequestCounter
        eventCount={props.allEvents.length}
        filteredEventCount={props.filteredEvents.length}
    />
    <ButtonsContainer>
        <PlayPauseButton />
        <ExportAsHarButton exchanges={
            // Drop TLS errors from HAR exports
            props.filteredEvents.filter(isHttpExchange)
        } />
        <ImportHarButton />
        <ClearAllButton
            disabled={props.allEvents.length === 0}
            onClear={props.onClear}
        />
    </ButtonsContainer>
</div>))`
    order: 1;

    min-height: ${HEADER_FOOTER_HEIGHT}px;
    width: 100%;
    padding-left: 2px;
    box-sizing: border-box;

    background-color: ${p => p.theme.mainBackground};

    display: flex;
    align-items: center;
    justify-content: space-between;
`;