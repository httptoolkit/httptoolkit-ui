import * as React from 'react';
import styled from 'styled-components';

import { DomWithProps } from '../types';
import { HttpExchange } from '../model/store';

import { EmptyState } from './empty-state';
import { StatusCode } from './status-code';

const HeaderSize = '40px';

const TableRoot = styled.section`
    position: relative;
    padding-top: ${HeaderSize};
    height: 100%;
    box-sizing: border-box;

    background-color: ${props => props.theme.containerBackground};
`;

const HeaderBackground = styled.div`
    background-color: ${props => props.theme.mainBackground};
    border-bottom: 1px solid ${props => props.theme.containerBorder};
    box-shadow: 0 0 30px rgba(0,0,0,0.2);

    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: ${HeaderSize};
`;

const TableScrollContainer = styled.div`
    overflow-y: auto;
    height: 100%;
`;

const Table = styled.table`
    width: calc(100% - 10px);
    height: 100%;

    margin: -1px 5px 0;

    font-size: 14px;

    border-collapse: separate;
    border-spacing: 0 3px;
`;

const HeaderContentWrapper = styled.div`
    position: absolute;
    top: 0;
    height: 40px;
    display: flex;
    align-items: center;
    padding-left: 5px;
`;

const Th = styled((props: { className?: string, children: JSX.Element[] | string }) => {
    return <th className={props.className}>
        <HeaderContentWrapper>
            {props.children}
        </HeaderContentWrapper>
    </th>
})`
    height: 0;
    padding: 0;
    min-width: 45px;

    font-size: 16px;
    font-weight: bold;
    background-color: ${props => props.theme.mainBackground};
    color: ${props => props.theme.mainColor};
`;

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
        return '#ffc107';
    }
};

const Tr = styled.tr`
    width: 100%;
    word-break: break-all;

    /* Acts as a default height, when the table isn't yet full */
    height: 30px;

    background-color: ${(props: { isSelected: boolean, theme: any }) => 
        props.isSelected ? props.theme.popBackground : props.theme.mainBackground
    };
    color: ${(props: { isSelected: boolean, theme: any }) => 
        props.isSelected ? props.theme.popColor : props.theme.mainColor
    };;

    user-select: none;

    cursor: pointer;

    > :first-child {
        border-left: 5px solid ${(props: any) => getColour(props.exchange)};
        border-radius: 2px 0 0 2px;
    }

    > :last-child {
        border-radius: 0 2px 2px 0;
    }
` as any as DomWithProps<HTMLTableRowElement, {
    exchange: HttpExchange,
    isSelected: boolean
}>;

const Td = styled.td`
    padding: 8px 5px;
    vertical-align: middle;

    &.method {
        white-space: nowrap;
        font-weight: 800;
    }
`;

const Ellipsis = styled(({ className }: { className?: string }) =>
    <span className={className}>&nbsp;…&nbsp;</span>
)`
    opacity: 0.5;
`;

const truncate = (str: string, length: number, trailingLength: number = 0) => {
    if (str.length <= length) {
        return str;
    } else {
        return <>
            {str.slice(0, length - 3 - trailingLength)}
            <Ellipsis/>
            {str.slice(str.length - trailingLength)}
        </>;
    }
}

interface ExchangeRowProps {
    exchange: HttpExchange;
    onSelected: () => void;
    onDeselected: () => void;
    isSelected: boolean;
}

class ExchangeRow extends React.Component<ExchangeRowProps, {}> {
    shouldComponentUpdate(nextProps: ExchangeRowProps) {
        return this.props.exchange !== nextProps.exchange ||
            this.props.isSelected !== nextProps.isSelected;
    }

    render() {
        const { exchange, isSelected } = this.props;
        const url = new URL(
            exchange.request.url,
            `${exchange.request.protocol}://${exchange.request.hostname}`
        );

        return <Tr
            exchange={exchange}
            onClick={this.onClick}
            onKeyPress={this.onKeyPress}
            isSelected={isSelected}
            tabIndex={0}
        >
            <Td className='method'>{exchange.request.method}</Td>
            <Td>
                <StatusCode
                    status={exchange.response && exchange.response.statusCode}
                    message={exchange.response && exchange.response.statusMessage}
                />
            </Td>
            <Td>{truncate(url.host, 30, 4)}</Td>
            <Td>{truncate(url.pathname, 40, 4)}</Td>
            <Td>{truncate(url.search.slice(1), 40)}</Td>
        </Tr>
    }

    onClick = () => {
        const { isSelected, onSelected, onDeselected } = this.props

        if (isSelected) {
            onDeselected();
        } else {
            onSelected();
        }
    }

    onKeyPress = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            this.onClick();
        }
    }
}

const EmptyStateOverlay = EmptyState.extend`
    position: absolute;
    top: 40px;
    bottom: 40px;
    height: auto;
`;

interface ExchangeListProps {
    onSelected: (request: HttpExchange | undefined) => void;
    exchanges: HttpExchange[];
}

export class ExchangeList extends React.PureComponent<ExchangeListProps, {
    selectedExchange: HttpExchange | undefined
}> {
    constructor(props: ExchangeListProps) {
        super(props);
        this.state = {
            selectedExchange: undefined
        };
    }

    render() {
        const { exchanges } = this.props;
        const { selectedExchange } = this.state;

        return <TableRoot>
            <HeaderBackground/>
            <TableScrollContainer>
                <Table>
                    <thead>
                        <tr>
                            <Th>Verb</Th>
                            <Th>Status</Th>
                            <Th>Host</Th>
                            <Th>Path</Th>
                            <Th>Query</Th>
                        </tr>
                    </thead>
                    <tbody>
                        { exchanges.map((exchange, i) => (
                            <ExchangeRow
                                key={i}
                                exchange={exchange}
                                onSelected={() => this.exchangeSelected(exchange)}
                                onDeselected={() => this.exchangeDeselected()}
                                isSelected={selectedExchange === exchange}
                            />
                        )) }
                        <tr></tr>{/* This fills up empty space at the bottom to stop other rows expanding */}
                    </tbody>
                </Table>
                { exchanges.length === 0 ?
                    <EmptyStateOverlay icon={['far', 'spinner-third']} spin message='Requests will appear here, once you send some...' />
                    : null }
            </TableScrollContainer>
        </TableRoot>;
    }

    exchangeSelected(exchange: HttpExchange) {
        this.setState({
            selectedExchange: exchange
        });
        this.props.onSelected(exchange);
    }

    exchangeDeselected() {
        this.setState({ selectedExchange: undefined });
        this.props.onSelected(undefined);
    }
}