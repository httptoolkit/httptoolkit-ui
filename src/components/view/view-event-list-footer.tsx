import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';

import { styled } from '../../styles';

import { HttpExchange } from '../../model/http/exchange';
import { CollectedEvent } from '../../model/http/events-store';
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
    searchFilters: FilterSet,
    onSearchFiltersConsidered: (filters: FilterSet | undefined) => void,
    onSearchFiltersChanged: (filters: FilterSet) => void,

    allEvents: CollectedEvent[],
    filteredEvents: CollectedEvent[]
}) => <div className={props.className}>
    <SearchFilter
        searchFilters={props.searchFilters}
        onSearchFiltersConsidered={props.onSearchFiltersConsidered}
        onSearchFiltersChanged={props.onSearchFiltersChanged}
        availableFilters={SelectableSearchFilterClasses}
        placeholder='Filter by URL, headers, status...'
    />
    <RequestCounter
        eventCount={props.allEvents.length}
        filteredEventCount={props.filteredEvents.length}
    />
    <ButtonsContainer>
        <PlayPauseButton />
        <ExportAsHarButton exchanges={
            props.filteredEvents.filter(
                // Drop TLS errors from HAR exports
                (event): event is HttpExchange => 'request' in event
            )
        } />
        <ImportHarButton />
        <ClearAllButton
            disabled={props.allEvents.length === 0}
            onClear={props.onClear}
        />
    </ButtonsContainer>
</div>))`
    position: absolute;
    bottom: 0;

    height: ${HEADER_FOOTER_HEIGHT}px;
    width: 100%;
    padding-left: 2px;
    box-sizing: border-box;

    background-color: ${p => p.theme.mainBackground};

    display: flex;
    align-items: center;
    justify-content: space-between;
`;