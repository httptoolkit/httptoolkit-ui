import * as React from 'react';
import { get } from 'typesafe-get';
import styled from 'styled-components';
import 'react-virtualized/styles.css';

import { AutoSizer, Table, Column, TableRowProps } from 'react-virtualized';

import { HttpExchange } from '../model/store';

import { EmptyState } from './empty-state';
import { StatusCode } from './status-code';

const getColour = (exchange: HttpExchange) => {
    if (exchange.request.method === 'POST') {
        return '#ce3939';
    } else if (exchange.request.path.endsWith('.js')) {
        return '#4c86af';
    } else if (exchange.request.path.endsWith('/') || exchange.request.path.endsWith('.html')) {
        return '#574caf';
    } else if (exchange.request.path.endsWith('.css')) {
        return '#af4c9a';
    } else if (exchange.request.path.endsWith('.jpg') ||
        exchange.request.path.endsWith('.jpeg') ||
        exchange.request.path.endsWith('.png') ||
        exchange.request.path.endsWith('.gif')) {
        return '#4caf7d';
    } else {
        return '#888';
    }
};

const RowMarker = styled.div`
    color: ${(p: { exchange: HttpExchange }) => getColour(p.exchange)};
    background-color: currentColor;

    width: 5px;
    height: 100%;

    border-left: 5px solid ${p => p.theme.containerBackground};
`;

const MarkerHeader = styled.div`
    width: 10px;
`;

const EmptyStateOverlay = EmptyState.extend`
    position: absolute;
    top: 40px;
    bottom: 40px;
    height: auto;
`;

interface ExchangeListProps {
    className?: string;
    onSelected: (request: HttpExchange | undefined) => void;
    exchanges: HttpExchange[];
}

export const ExchangeList = styled(class extends React.PureComponent<ExchangeListProps, {
    selectedExchangeIndex: number | undefined
}> {
    constructor(props: ExchangeListProps) {
        super(props);
        this.state = {
            selectedExchangeIndex: undefined
        };
    }

    tableContainerRef: HTMLElement | null;
    tableRef: Table | null;

    render() {
        const { exchanges, className } = this.props;
        const { selectedExchangeIndex } = this.state;

        return <AutoSizer>{({ height, width }) =>
            <div
                ref={(e) => this.tableContainerRef = e}
                onKeyDown={this.onKeyDown}
            >
                <Table
                    ref={(table) => this.tableRef = table}
                    className={className}
                    height={height}
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
                    }: TableRowProps & { key: any } /* TODO: Add to R-V types */) => <div
                        aria-label='row'
                        aria-rowindex={index + 1}
                        tabIndex={-1}

                        className={className}
                        key={key}
                        role="row"
                        style={style}
                        onClick={(event: React.MouseEvent) =>
                            onRowClick && onRowClick({ event, index, rowData })
                        }
                    >
                        {columns}
                    </div>}
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
                        width={75}
                        flexShrink={0}
                        flexGrow={0}
                    />
                    <Column
                        label="Status"
                        dataKey="status"
                        className="status"
                        width={58}
                        flexShrink={0}
                        flexGrow={0}
                        cellRenderer={({ rowData }) =>
                            <StatusCode
                                status={get(rowData, 'response', 'statusCode')}
                                message={get(rowData, 'response', 'statusMessage')}
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
        }</AutoSizer>;
    }

    focusSelectedExchange = () => {
        if (!this.tableContainerRef) return;

        if (this.state.selectedExchangeIndex != null) {
            const rowElement = this.tableContainerRef.querySelector(
                `[aria-rowindex='${this.state.selectedExchangeIndex + 1}']`
            ) as HTMLDivElement;
            rowElement.focus();

            this.tableRef!.scrollToRow(this.state.selectedExchangeIndex);
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

    onExchangeSelected(index: number, callback?: () => void) {
        this.setState({
            selectedExchangeIndex: index
        }, callback);
        this.props.onSelected(this.props.exchanges[index]);
    }

    onExchangeDeselected() {
        this.setState({ selectedExchangeIndex: undefined });
        this.props.onSelected(undefined);
    }

    onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (this.props.exchanges.length === 0) return;

        const { exchanges } = this.props;
        const { selectedExchangeIndex } = this.state;

        let targetIndex: number | undefined;

        switch (event.key) {
            case 'j':
            case 'ArrowDown':
                targetIndex = selectedExchangeIndex === undefined ?
                    0 : Math.min(selectedExchangeIndex + 1, exchanges.length - 1);
                break;
            case 'k':
            case 'ArrowUp':
                targetIndex = selectedExchangeIndex === undefined ?
                    exchanges.length - 1 : Math.max(selectedExchangeIndex - 1, 0);
                break;
        }

        if (targetIndex !== undefined) {
            this.onExchangeSelected(targetIndex, this.focusSelectedExchange);
            event.preventDefault();
        }
    }
})`
    .ReactVirtualized__Table__headerRow {
        background-color: ${props => props.theme.mainBackground};
        color: ${props => props.theme.mainColor};

        border-bottom: 1px solid ${props => props.theme.containerBorder};
        box-shadow: 0 0 30px rgba(0,0,0,0.2);

        font-size: 16px;

        // For some reason, without this when the table starts scrolling
        // the header adds padding & pops out of the container
        padding-right: 0 !important;
    }

    .marker {
        height: 100%;
        margin-left: 0px;
        margin-right: 5px;
    }

    .ReactVirtualized__Table__row {
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
            font-weight: bold;
        }
    }

    .ReactVirtualized__Table__rowColumn {
        padding: 5px 0;
    }
`;