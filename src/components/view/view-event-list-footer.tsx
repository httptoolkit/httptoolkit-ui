import * as React from 'react';
import { observer } from 'mobx-react';

import { styled } from '../../styles';

import { HttpExchange } from '../../model/exchange';

import { ClearAllButton, ExportAsHarButton, ImportHarButton, PlayPauseButton } from './view-event-list-buttons';
import { SearchBox } from '../common/search-box';
import { CollectedEvent } from './view-event-list';

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

const EventSearchBox = styled(SearchBox)`
    flex-basis: 60%;

    > input {
        font-size: ${p => p.theme.textSize};
        padding: 5px 12px;
    }
`;

const ButtonsContainer = styled.div`
    display: flex;
`;

export const TableFooter = styled(observer((props: {
    className?: string,
    onClear: () => void,
    currentSearch: string,
    onSearch: (input: string) => void,

    allEvents: CollectedEvent[],
    filteredEvents: CollectedEvent[]
}) => <div className={props.className}>
    <EventSearchBox
        value={props.currentSearch}
        onSearch={props.onSearch}
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
        <ClearAllButton disabled={props.allEvents.length === 0} onClear={props.onClear} />
    </ButtonsContainer>
</div>))`
    position: absolute;
    bottom: 0;

    height: ${HEADER_FOOTER_HEIGHT}px;
    width: 100%;
    padding-left: 5px;
    box-sizing: border-box;

    background-color: ${p => p.theme.mainBackground};

    display: flex;
    align-items: center;
    justify-content: space-between;
`;