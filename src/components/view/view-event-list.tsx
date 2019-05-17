import * as _ from 'lodash';
import * as React from 'react';
import { get } from 'typesafe-get';
import { observer, Observer } from 'mobx-react';
import { observable, action, computed } from 'mobx';

import { AutoSizer, Table, Column, TableRowProps } from 'react-virtualized';

import { styled } from '../../styles'
import { FontAwesomeIcon } from '../../icons';
import { FailedTlsRequest } from '../../types';

import { HttpExchange } from '../../model/exchange';
import { getExchangeSummaryColour, ExchangeCategory } from '../../exchange-colors';

import { EmptyState } from '../common/empty-state';
import { StatusCode } from '../common/status-code';

import { TableFooter, HEADER_FOOTER_HEIGHT } from './view-event-list-footer';

const RowMarker = styled.div`
    transition: color 0.1s;
    color: ${(p: { category: ExchangeCategory }) => getExchangeSummaryColour(p.category)};

    background-color: currentColor;

    width: 5px;
    height: 100%;

    border-left: 5px solid ${p => p.theme.containerBackground};
`;

const MarkerHeader = styled.div`
    width: 10px;
`;

const EmptyStateOverlay = styled(EmptyState)`
    position: absolute;
    top: ${HEADER_FOOTER_HEIGHT}px;
    bottom: ${HEADER_FOOTER_HEIGHT}px;
    height: auto;
`;

export type CollectedEvent = HttpExchange | FailedTlsRequest

interface ViewEventListProps {
    className?: string;
    onSelected: (event: CollectedEvent | undefined) => void;
    onClear: () => void;
    events: CollectedEvent[];
    isPaused: boolean;
}

const ListContainer = styled.div`
    width: 100%;
    height: 100%;

    font-size: ${p => p.theme.textSize};

    &::after {
        content: '';
        position: absolute;
        top: ${HEADER_FOOTER_HEIGHT}px;
        bottom: ${HEADER_FOOTER_HEIGHT}px;
        left: 0;
        right: 0;
        box-shadow: rgba(0, 0, 0, 0.1) 0px 0px 30px inset;
        pointer-events: none;
    }

    .ReactVirtualized__Table__headerRow {
        display: flex;
        flex-direction: row;
        align-items: center;

        background-color: ${props => props.theme.mainBackground};
        color: ${props => props.theme.mainColor};
        font-weight: bold;

        border-bottom: 1px solid ${props => props.theme.containerBorder};
        box-shadow: 0 0 30px rgba(0,0,0,0.2);

        /* React-Virtualized adds padding when the scrollbar appears (on the
           table and header). Without this, the header pops out of the table. */
        box-sizing: border-box;
    }

    .ReactVirtualized__Table__headerTruncatedText {
        display: inline-block;
        max-width: 100%;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
    }

    .marker {
        height: 100%;
        margin-left: 0px;
        margin-right: 5px;
    }

    .source > svg {
        display: block;
        margin: 0 auto;
    }

    .ReactVirtualized__Table__row {
        display: flex;
        flex-direction: row;
        align-items: center;

        user-select: none;
        cursor: pointer;

        &:focus {
            outline: thin dotted ${p => p.theme.popColor};
        }

        &.selected {
            font-weight: bold;
        }

        &.exchange-row {
            background-color: ${props => props.theme.mainBackground};

            border-width: 2px 0;
            border-style: solid;
            border-color: transparent;
            background-clip: padding-box;
            box-sizing: border-box;

            &:hover ${RowMarker}, &.selected ${RowMarker} {
                border-color: currentColor;
            }

            &.selected {
                color: ${p => p.theme.highlightColor};
                background-color: ${p => p.theme.highlightBackground};
            }
        }

        &.tls-failure-row {
            height: 28px !important; /* Important required to override virtualized's style attr */
            margin: 2px 0;

            justify-content: center;
            font-style: italic;

            opacity: 0.7;

            &:hover {
                opacity: 1;
            }

            &.selected {
                opacity: 1;
                color: ${p => p.theme.mainColor};
                background-color: ${p => p.theme.mainBackground};
            }
        }
    }

    .ReactVirtualized__Table__rowColumn,
    .ReactVirtualized__Table__headerColumn {
        padding: 5px 0;
        margin-right: 10px;
        min-width: 0px;

        &:first-of-type {
            margin-left: 0;
        }
    }

    .ReactVirtualized__Table__rowColumn {
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .ReactVirtualized__Grid__innerScrollContainer {
        // Ensures that row outlines on the last row are visible
        padding-bottom: 2px;
    }
`;

const FailedRequestRow = (p: { failure: FailedTlsRequest }) =>
    <div>
        {
            ({
                'closed': 'Aborted ',
                'reset': 'Aborted ',
                'unknown': 'Aborted ',
                'cert-rejected': 'Certificate rejected for ',
                'no-shared-cipher': 'HTTPS setup failed for ',
            } as _.Dictionary<string>)[p.failure.failureCause]
        }
        connection to { p.failure.hostname || 'unknown domain' }
    </div>

@observer
export class ViewEventList extends React.Component<ViewEventListProps> {

    @observable selectedEventId: string | undefined;

    @observable searchFilter: string | false = false;

    @computed
    private get filteredEvents() {
        if (!this.searchFilter) return this.props.events;

        let filter = this.searchFilter.toLocaleLowerCase();
        return this.props.events.filter((event) => {
            return event.searchIndex.includes(filter)
        });
    }

    private tableContainerRef: HTMLDivElement | null | undefined;
    private tableRef: Table | null | undefined;

    render() {
        const { events, className, onClear, isPaused } = this.props;
        const { selectedEventId, filteredEvents } = this;

        console.log(events);

        return <ListContainer>
            {/* Footer is above the table in HTML order to ensure correct tab order */}
            <TableFooter
                allEvents={events}
                filteredEvents={filteredEvents}
                currentSearch={this.searchFilter || ''}
                onSearch={this.onSearchInput}
                onClear={onClear}
            />

            <AutoSizer>{({ height, width }) =>
                <Observer>{() =>
                    <div
                        ref={(e) => this.tableContainerRef = e}
                        onKeyDown={this.onKeyDown}
                    >
                        <Table
                            ref={(table) => this.tableRef = table}
                            className={className}
                            height={height - (HEADER_FOOTER_HEIGHT + 2)} // Leave space for the footer
                            width={width}
                            rowHeight={32}
                            headerHeight={HEADER_FOOTER_HEIGHT}
                            // Unset tabindex if a row is selected
                            tabIndex={selectedEventId != null ? -1 : 0}
                            rowCount={filteredEvents.length}
                            rowGetter={({ index }) => filteredEvents[index]}
                            onRowClick={({ rowData, index }) => {
                                if (selectedEventId !== rowData.id) {
                                    this.onEventSelected(index);
                                } else {
                                    this.onEventDeselected();
                                }
                            }}
                            rowClassName={({ index }) => {
                                const classes = [];
                                const event = filteredEvents[index] || {};

                                if (selectedEventId === event.id) {
                                    classes.push('selected');
                                }

                                if ('request' in event) {
                                    classes.push('exchange-row');
                                } else {
                                    classes.push('tls-failure-row');
                                }

                                return classes.join(' ');
                            }}
                            noRowsRenderer={() =>
                                isPaused
                                    ? <EmptyStateOverlay icon={['fas', 'pause']}>
                                        Interception is paused, resume it to collect intercepted requests
                                    </EmptyStateOverlay>
                                    : <EmptyStateOverlay icon={['fas', 'plug']}>
                                        Connect a client and intercept some requests, and they'll appear here
                                    </EmptyStateOverlay>
                            }
                            rowRenderer={(({
                                columns,
                                className,
                                style,
                                onRowClick,
                                index,
                                rowData,
                                key
                            }: TableRowProps & { key: string, rowData: CollectedEvent }) =>
                                <div
                                    key={key}
                                    aria-label='row'
                                    aria-rowindex={index + 1}
                                    tabIndex={selectedEventId === rowData.id ? 0 : -1}
                                    data-event-id={rowData.id}

                                    className={className}
                                    role="row"
                                    style={style}
                                    onClick={(event: React.MouseEvent) =>
                                        onRowClick && onRowClick({ event, index, rowData })
                                    }
                                >
                                    { 'request' in rowData
                                        ? columns
                                        : <FailedRequestRow failure={rowData} />
                                    }
                                </div>
                            ) as any /* Required so we can hack the 'key' in here */}
                        >
                            <Column
                                label=""
                                dataKey="marker"
                                className="marker"
                                headerClassName="marker"
                                headerRenderer={() => <MarkerHeader />}
                                cellRenderer={({ rowData }: { rowData: CollectedEvent }) =>
                                    'category' in rowData
                                        ? <Observer>{() => <RowMarker category={rowData.category} />}</Observer>
                                        : null
                                }
                                width={10}
                                flexShrink={0}
                                flexGrow={0}
                            />
                            <Column
                                label="Verb"
                                dataKey="method"
                                cellDataGetter={({ rowData }) =>
                                    'request' in rowData
                                        ? rowData.request.method
                                        : null
                                }
                                width={71}
                                flexShrink={0}
                                flexGrow={0}
                            />
                            <Column
                                label="Status"
                                dataKey="status"
                                className="status"
                                width={45}
                                flexShrink={0}
                                flexGrow={0}
                                cellRenderer={({ rowData }) =>
                                    'request' in rowData
                                        ? <Observer>{() =>
                                            <StatusCode
                                                status={get(rowData, 'response', 'statusCode') || rowData.response}
                                                message={get(rowData, 'response', 'statusMessage')}
                                            />
                                        }</Observer>
                                        : null
                                }
                            />
                            <Column
                                label="Source"
                                dataKey="source"
                                className="source"
                                width={49}
                                flexShrink={0}
                                flexGrow={0}
                                cellRenderer={({ rowData }) =>

                                    'request' in rowData
                                        ? <FontAwesomeIcon
                                            title={rowData.request.source.summary}
                                            {...rowData.request.source.icon}
                                            fixedWidth={true}
                                        />
                                        : null
                                }
                            />
                            <Column
                                label="Host"
                                dataKey="host"
                                width={500}
                                cellDataGetter={({ rowData }) =>
                                    'request' in rowData
                                        ? rowData.request.parsedUrl.host
                                        : null
                                }
                            />
                            <Column
                                label="Path and query"
                                dataKey="path"
                                width={1000}
                                cellDataGetter={({ rowData }) =>
                                    'request' in rowData
                                        ? rowData.request.parsedUrl.pathname + rowData.request.parsedUrl.search
                                        : null
                                }
                            />
                        </Table>
                    </div>
                }</Observer>
            }</AutoSizer>
        </ListContainer>;
    }

    focusSelectedEvent = () => {
        if (
            !this.tableRef ||
            !this.tableContainerRef ||
            !this.tableContainerRef.contains(document.activeElement)
        ) return;

        // Something in the table is focused - make sure it's the correct thing.

        if (this.selectedEventId != null) {
            const rowElement = this.tableContainerRef.querySelector(
                `[data-event-id='${this.selectedEventId}']`
            ) as HTMLDivElement;
            if (rowElement) {
                rowElement.focus();
            }
        } else {
            const tableElement = this.tableContainerRef.querySelector('.ReactVirtualized__Table__Grid') as HTMLDivElement;
            tableElement.focus();
        }
    }

    componentDidMount() {
        if (this.tableContainerRef) {
            const tableElement = this.tableContainerRef.querySelector('.ReactVirtualized__Table__Grid') as HTMLDivElement;
            tableElement.addEventListener('focus', this.focusSelectedEvent);
        }
    }

    componentWillUnmount() {
        if (this.tableContainerRef) {
            const tableElement = this.tableContainerRef.querySelector('.ReactVirtualized__Table__Grid') as HTMLDivElement;
            tableElement.removeEventListener('focus', this.focusSelectedEvent);
        }
    }

    componentDidUpdate() {
        this.focusSelectedEvent();
    }

    @action.bound
    onEventSelected(index: number) {
        this.selectedEventId = this.filteredEvents[index].id;
        this.props.onSelected(this.filteredEvents[index]);
    }

    @action.bound
    onEventDeselected() {
        this.selectedEventId = undefined;
        this.props.onSelected(undefined);
    }

    @action.bound
    onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if (this.filteredEvents.length === 0) return;

        const { filteredEvents } = this;

        let currentIndex = _.findIndex(filteredEvents, { id: this.selectedEventId });
        let targetIndex: number | undefined;

        switch (event.key) {
            case 'j':
            case 'ArrowDown':
                targetIndex = currentIndex === undefined ?
                    0 : Math.min(currentIndex + 1, filteredEvents.length - 1);
                break;
            case 'k':
            case 'ArrowUp':
                targetIndex = currentIndex === undefined ?
                filteredEvents.length - 1 : Math.max(currentIndex - 1, 0);
                break;
            case 'PageUp':
                targetIndex = currentIndex === undefined ?
                    undefined : Math.max(currentIndex - 10, 0);
                break;
            case 'PageDown':
                targetIndex = currentIndex === undefined ?
                    undefined : Math.min(currentIndex + 10, filteredEvents.length - 1);
                break;
        }

        if (targetIndex !== undefined) {
            this.onEventSelected(targetIndex);
            this.focusSelectedEvent();
            this.tableRef!.scrollToRow(targetIndex);
            event.preventDefault();
        }
    }

    @action.bound
    onSearchInput(input: string) {
        this.searchFilter = input || false;
    }
}