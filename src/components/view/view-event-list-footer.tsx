import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';

import { styled } from '../../styles';
import { CollectedEvent } from '../../types';

import {
    FilterSet,
    SelectableSearchFilterClasses
} from '../../model/filters/search-filters';

import { ClearAllButton, ExportAsHarButton, ImportHarButton, PlayPauseButton, ScrollToEndButton } from './view-event-list-buttons';
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
    onScrollToEnd: () => void,

    allEvents: CollectedEvent[],
    filteredEvents: CollectedEvent[],

    // We track this separately because it's not 100% accurate to show it
    // live from the events above, because filteredEvents is debounced. If
    // we're not careful, we show 9/10 at times just because filtering
    // hasn't been run against the latest events quite yet.
    filteredCount: [filtered: number, fromTotal: number],

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
        filteredEventCount={props.filteredCount[0]}
        eventCount={props.filteredCount[1]}
    />
    <ButtonsContainer>
        <PlayPauseButton />
        <ScrollToEndButton onScrollToEnd={props.onScrollToEnd} />
        <ExportAsHarButton events={props.filteredEvents} />
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