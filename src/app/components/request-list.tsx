import * as React from 'react';
import * as ReactDOM from 'react-dom';
import styled, { css } from 'styled-components';

import { MockttpRequest, DomWithProps } from '../types';
import { EmptyState } from './empty-state';

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
    background-color: rgba(255, 255, 255, 0.8);
    color: #222;
`;

const getColour = (request: MockttpRequest) => {
    if (request.method === 'POST') {
        return '#ce3939';
    } else if (request.path.endsWith('.js')) {
        return '#4c86af';
    } else if (request.path.endsWith('/') || request.path.endsWith('.html')) {
        return '#574caf';
    } else if (request.path.endsWith('.css')) {
        return '#af4c9a';
    } else if (request.path.endsWith('.jpg') || request.path.endsWith('.jpeg') || request.path.endsWith('.png') || request.path.endsWith('.gif')) {
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
        props.isSelected ? props.theme.containerWatermark : props.theme.mainBackground
    };
    color: #222;

    user-select: none;

    cursor: pointer;

    > :first-child {
        border-left: 5px solid ${(props: any) => getColour(props.request)};
        border-radius: 2px 0 0 2px;
    }

    > :last-child {
        border-radius: 0 2px 2px 0;
    }
` as any as DomWithProps<HTMLTableRowElement, {
    request: MockttpRequest,
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

interface RequestRowProps {
    request: MockttpRequest;
    onSelected: () => void;
    isSelected: boolean;
}

class RequestRow extends React.Component<RequestRowProps, {}> {
    shouldComponentUpdate(nextProps: RequestRowProps) {
        return this.props.request !== nextProps.request ||
            this.props.isSelected !== nextProps.isSelected;
    }

    render() {
        const { request, isSelected } = this.props;
        const url = new URL(request.url);

        return <Tr request={request} onClick={this.props.onSelected} isSelected={isSelected}>
            <Td className='method'>{request.method}</Td>
            <Td>{truncate(url.host, 30, 4)}</Td>
            <Td>{truncate(url.pathname, 40, 4)}</Td>
            <Td>{truncate(url.search.slice(1), 40)}</Td>
        </Tr>
    }
}

const EmptyStateOverlay = EmptyState.extend`
    position: absolute;
    top: 40px;
    bottom: 40px;
    height: auto;
`;

interface RequestListProps {
    requests: MockttpRequest[]
}

export class RequestList extends React.PureComponent<RequestListProps, {
    selectedRequests: MockttpRequest[]
}> {
    constructor(props: RequestListProps) {
        super(props);
        this.state = {
            selectedRequests: []
        };
    }

    render() {
        const { requests } = this.props;
        const { selectedRequests } = this.state;

        return <TableRoot>
            <HeaderBackground/>
            <TableScrollContainer>
                <Table>
                    <thead>
                        <tr>
                            <Th>Verb</Th>
                            <Th>Host</Th>
                            <Th>Path</Th>
                            <Th>Query</Th>
                        </tr>
                    </thead>
                    <tbody>
                        { requests.map((req, i) => (
                            <RequestRow
                                key={i}
                                request={req}
                                onSelected={() => this.requestSelected(req)}
                                isSelected={selectedRequests.indexOf(req) > -1}
                            />
                        )) }
                        <tr></tr>{/* This fills up empty space at the bottom to stop other rows expanding */}
                    </tbody>
                </Table>
                { requests.length === 0 ?
                    <EmptyStateOverlay icon={['far', 'spinner-third']} spin message='Requests will appear here, once you send some...' />
                    : null }
            </TableScrollContainer>
        </TableRoot>;
    }

    requestSelected(req: MockttpRequest) {
        this.setState({
            selectedRequests: [req]
        });
    }
}