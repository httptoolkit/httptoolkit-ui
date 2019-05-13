import * as _ from 'lodash';
import * as React from 'react';
import { get } from 'typesafe-get';
import { observer, Observer } from 'mobx-react';
import { observable, action, computed } from 'mobx';

import { AutoSizer, Table, Column, TableRowProps } from 'react-virtualized';

import { styled } from '../../styles'
import { FontAwesomeIcon } from '../../icons';

import { HttpExchange } from '../../model/exchange';
import { getExchangeSummaryColour, ExchangeCategory } from '../../exchange-colors';

import { EmptyState } from '../common/empty-state';
import { StatusCode } from '../common/status-code';

import { TableFooter, HEADER_FOOTER_HEIGHT } from './exchange-list-footer';

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

interface ExchangeListProps {
    className?: string;
    onSelected: (request: HttpExchange | undefined) => void;
    onClear: () => void;
    exchanges: HttpExchange[];
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
            background-color: ${p => p.theme.highlightBackground};
            color: ${p => p.theme.highlightColor};
            font-weight: bold;
        }

        &:focus {
            outline: thin dotted ${p => p.theme.popColor};
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

@observer
export class ExchangeList extends React.Component<ExchangeListProps> {

    @observable selectedExchangeId: string | undefined;

    @observable searchFilter: string | false = false;

    @computed
    private get filteredExchanges() {
        if (!this.searchFilter) return this.props.exchanges;

        let filter = this.searchFilter.toLocaleLowerCase();
        return this.props.exchanges.filter((exchange) =>
            exchange.searchIndex.includes(filter)
        );
    }

    private tableContainerRef: HTMLDivElement | null | undefined;
    private tableRef: Table | null | undefined;

    render() {
        const { exchanges, className, onClear, isPaused } = this.props;
        const { selectedExchangeId, filteredExchanges } = this;

        return <ListContainer>
            {/* Footer is above the table in HTML order to ensure correct tab order */}
            <TableFooter
                allExchanges={exchanges}
                filteredExchanges={filteredExchanges}
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
                            tabIndex={selectedExchangeId != null ? -1 : 0}
                            rowCount={filteredExchanges.length}
                            rowGetter={({ index }) => filteredExchanges[index]}
                            onRowClick={({ rowData, index }) => {
                                if (selectedExchangeId !== rowData.id) {
                                    this.onExchangeSelected(index);
                                } else {
                                    this.onExchangeDeselected();
                                }
                            }}
                            rowClassName={({ index }) =>
                                (selectedExchangeId === (filteredExchanges[index] || {}).id) ? 'selected' : ''
                            }
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
                            }: TableRowProps & { key: string }) =>
                                <div
                                    key={key}
                                    aria-label='row'
                                    aria-rowindex={index + 1}
                                    tabIndex={selectedExchangeId === rowData.id ? 0 : -1}
                                    data-exchange-id={rowData.id}

                                    className={className}
                                    role="row"
                                    style={style}
                                    onClick={(event: React.MouseEvent) =>
                                        onRowClick && onRowClick({ event, index, rowData })
                                    }
                                >
                                    {columns}
                                </div>
                            ) as any /* Required so we can hack the 'key' in here */}
                        >
                            <Column
                                label=""
                                dataKey="marker"
                                className="marker"
                                headerClassName="marker"
                                headerRenderer={() => <MarkerHeader />}
                                cellRenderer={({ rowData }: { rowData: HttpExchange }) => <Observer>{() =>
                                    <RowMarker category={rowData.category} />
                                }</Observer>}
                                width={10}
                                flexShrink={0}
                                flexGrow={0}
                            />
                            <Column
                                label="Verb"
                                dataKey="method"
                                cellDataGetter={({ rowData }) => rowData.request.method}
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
                                    <Observer>{() =>
                                        <StatusCode
                                            status={get(rowData, 'response', 'statusCode') || rowData.response}
                                            message={get(rowData, 'response', 'statusMessage')}
                                        />
                                    }</Observer>
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
                                    <FontAwesomeIcon
                                        title={rowData.request.source.summary}
                                        {...rowData.request.source.icon}
                                        fixedWidth={true}
                                    />
                                }
                            />
                            <Column
                                label="Host"
                                dataKey="host"
                                width={500}
                                cellDataGetter={({ rowData }) => rowData.request.parsedUrl.host}
                            />
                            <Column
                                label="Path and query"
                                dataKey="path"
                                width={1000}
                                cellDataGetter={({ rowData }) => rowData.request.parsedUrl.pathname + rowData.request.parsedUrl.search}
                            />
                        </Table>
                    </div>
                }</Observer>
            }</AutoSizer>
        </ListContainer>;
    }

    focusSelectedExchange = () => {
        if (
            !this.tableRef ||
            !this.tableContainerRef ||
            !this.tableContainerRef.contains(document.activeElement)
        ) return;

        // Something in the table is focused - make sure it's the correct thing.

        if (this.selectedExchangeId != null) {
            const rowElement = this.tableContainerRef.querySelector(
                `[data-exchange-id='${this.selectedExchangeId}']`
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
            tableElement.addEventListener('focus', this.focusSelectedExchange);
        }
    }

    componentWillUnmount() {
        if (this.tableContainerRef) {
            const tableElement = this.tableContainerRef.querySelector('.ReactVirtualized__Table__Grid') as HTMLDivElement;
            tableElement.removeEventListener('focus', this.focusSelectedExchange);
        }
    }

    componentDidUpdate() {
        this.focusSelectedExchange();
    }

    @action.bound
    onExchangeSelected(index: number) {
        this.selectedExchangeId = this.filteredExchanges[index].id;
        this.props.onSelected(this.filteredExchanges[index]);
    }

    @action.bound
    onExchangeDeselected() {
        this.selectedExchangeId = undefined;
        this.props.onSelected(undefined);
    }

    @action.bound
    onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if (this.filteredExchanges.length === 0) return;

        const { filteredExchanges } = this;

        let currentIndex = _.findIndex(filteredExchanges, { id: this.selectedExchangeId });
        let targetIndex: number | undefined;

        switch (event.key) {
            case 'j':
            case 'ArrowDown':
                targetIndex = currentIndex === undefined ?
                    0 : Math.min(currentIndex + 1, filteredExchanges.length - 1);
                break;
            case 'k':
            case 'ArrowUp':
                targetIndex = currentIndex === undefined ?
                    filteredExchanges.length - 1 : Math.max(currentIndex - 1, 0);
                break;
            case 'PageUp':
                targetIndex = currentIndex === undefined ?
                    undefined : Math.max(currentIndex - 10, 0);
                break;
            case 'PageDown':
                targetIndex = currentIndex === undefined ?
                    undefined : Math.min(currentIndex + 10, filteredExchanges.length - 1);
                break;
        }

        if (targetIndex !== undefined) {
            this.onExchangeSelected(targetIndex);
            this.focusSelectedExchange();
            this.tableRef!.scrollToRow(targetIndex);
            event.preventDefault();
        }
    }

    @action.bound
    onSearchInput(input: string) {
        this.searchFilter = input || false;
    }
}