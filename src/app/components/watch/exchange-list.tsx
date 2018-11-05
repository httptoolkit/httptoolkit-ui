import * as React from 'react';
import { get } from 'typesafe-get';
import { observer, Observer } from 'mobx-react';
import { observable, action } from 'mobx';

import { AutoSizer, Table, Column, TableRowProps } from 'react-virtualized';

import { styled, FontAwesomeIcon } from '../../styles'

import { HttpExchange } from '../../model/store';
import { getExchangeSummaryColour } from '../exchange-colors';

import { EmptyState } from '../empty-state';
import { StatusCode } from '../status-code';

import { TableFooter } from './exchange-list-footer';

const RowMarker = styled.div`
    color: ${(p: { exchange: HttpExchange }) => getExchangeSummaryColour(p.exchange)};
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
    top: 40px;
    bottom: 40px;
    height: auto;
`;

interface ExchangeListProps {
    className?: string;
    onSelected: (request: HttpExchange | undefined) => void;
    onClear: () => void;
    exchanges: HttpExchange[];
}

const ListContainer = styled.div`
    width: 100%;
    height: 100%;

    font-size: ${p => p.theme.textSize};

    .ReactVirtualized__Table__headerRow {
        display: flex;
        flex-direction: row;
        align-items: center;

        background-color: ${props => props.theme.mainBackground};
        color: ${props => props.theme.mainColor};
        font-weight: bold;

        border-bottom: 1px solid ${props => props.theme.containerBorder};
        box-shadow: 0 0 30px rgba(0,0,0,0.2);

        // For some reason, without this when the table starts scrolling
        // the header adds padding & pops out of the container
        padding-right: 0 !important;
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
        outline: none;

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
            background-color: ${p => p.theme.popBackground};
            font-weight: bold;
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

    .ReactVirtualized__Table__Grid::after {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        box-shadow: rgba(0, 0, 0, 0.1) 0px 0px 30px inset;
        pointer-events: none;
    }
`;

@observer
export class ExchangeList extends React.Component<ExchangeListProps> {

    @observable selectedExchangeIndex: number | undefined;

    private tableContainerRef: HTMLElement | null;
    private tableRef: Table | null;

    render() {
        const { exchanges, className, onClear } = this.props;
        const { selectedExchangeIndex } = this;

        return <ListContainer>
            <AutoSizer>{({ height, width }) =>
                <Observer>{() =>
                    <div
                        ref={(e) => this.tableContainerRef = e}
                        onKeyDown={this.onKeyDown}
                    >
                        <Table
                            ref={(table) => this.tableRef = table}
                            className={className}
                            height={height - 42} // Leave space for the footer
                            width={width}
                            rowHeight={32}
                            headerHeight={38}
                            rowCount={exchanges.length}
                            rowGetter={({ index }) => exchanges[index]}
                            onRowClick={({ index }) => {
                                if (selectedExchangeIndex !== index) {
                                    this.onExchangeSelected(index);
                                } else {
                                    this.onExchangeDeselected();
                                }
                            }}
                            rowClassName={({ index }) =>
                                (selectedExchangeIndex === index) ? 'selected' : ''
                            }
                            noRowsRenderer={() =>
                                <EmptyStateOverlay
                                    icon={['far', 'spinner-third']}
                                    spin
                                    message='Requests will appear here, once you send some...'
                                />
                            }
                            rowRenderer={({
                                columns,
                                className,
                                style,
                                onRowClick,
                                key,
                                index,
                                rowData
                            }: TableRowProps & { key: any } /* TODO: Add to R-V types */) =>
                                <div
                                    aria-label='row'
                                    aria-rowindex={index + 1}
                                    tabIndex={-1}

                                    key={key}
                                    className={className}
                                    role="row"
                                    style={style}
                                    onClick={(event: React.MouseEvent) =>
                                        onRowClick && onRowClick({ event, index, rowData })
                                    }
                                >
                                    {columns}
                                </div>
                            }
                        >
                            <Column
                                label=""
                                dataKey="marker"
                                className="marker"
                                headerClassName="marker"
                                headerRenderer={() => <MarkerHeader />}
                                cellRenderer={({ rowData }) => <RowMarker exchange={rowData} />}
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
                                            status={get(rowData, 'response', 'statusCode')}
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
                                        title={rowData.request.source.description}
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
                                label="Path"
                                dataKey="path"
                                width={500}
                                cellDataGetter={({ rowData }) => rowData.request.parsedUrl.pathname}
                            />
                            <Column
                                label="Query"
                                dataKey="query"
                                width={500}
                                cellDataGetter={({ rowData }) => rowData.request.parsedUrl.search.slice(1)}
                            />
                        </Table>
                    </div>
                }</Observer>
            }</AutoSizer>
            <TableFooter exchanges={exchanges} onClear={onClear} />
        </ListContainer>;
    }

    focusSelectedExchange = () => {
        if (!this.tableContainerRef) return;

        if (this.selectedExchangeIndex != null) {
            const rowElement = this.tableContainerRef.querySelector(
                `[aria-rowindex='${this.selectedExchangeIndex + 1}']`
            ) as HTMLDivElement;
            rowElement.focus();

            this.tableRef!.scrollToRow(this.selectedExchangeIndex);
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

    @action.bound
    onExchangeSelected(index: number) {
        this.selectedExchangeIndex = index;
        this.props.onSelected(this.props.exchanges[index]);
    }

    @action.bound
    onExchangeDeselected() {
        this.selectedExchangeIndex = undefined;
        this.props.onSelected(undefined);
    }

    @action.bound
    onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if (this.props.exchanges.length === 0) return;

        const { exchanges } = this.props;

        // Forcibly focus the row that has been selected when it is selected?
        let targetIndex: number | undefined;

        switch (event.key) {
            case 'j':
            case 'ArrowDown':
                targetIndex = this.selectedExchangeIndex === undefined ?
                    0 : Math.min(this.selectedExchangeIndex + 1, exchanges.length - 1);
                break;
            case 'k':
            case 'ArrowUp':
                targetIndex = this.selectedExchangeIndex === undefined ?
                    exchanges.length - 1 : Math.max(this.selectedExchangeIndex - 1, 0);
                break;
        }

        if (targetIndex !== undefined) {
            this.onExchangeSelected(targetIndex);
            this.focusSelectedExchange();
            event.preventDefault();
        }
    }
}