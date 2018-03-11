import * as React from 'react';
import * as ReactDOM from 'react-dom';
import styled, { css } from 'styled-components';

import { MockttpRequest } from '../types';
import { EmptyState } from './empty-state';

const HeaderSize = '40px';

const TableRoot = styled.section`
    position: relative;
    padding-top: ${HeaderSize};
    height: 100%;
    box-sizing: border-box;

    background-color: #1c324a;
    box-shadow: inset 0 0 50px 2px rgba(0,0,0,0.5);
`;

const HeaderBackground = styled.div`
    background-color: #f3f4f5;
    box-shadow: 0 0 30px rgba(0,0,0,0.5);

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

const getColour = (method: string) => {
    if (method === 'GET') {
        return '#E91E63';
    } else {
        return '#4CAF50';
    }
};

const Tr = styled.tr`
    width: 100%;
    word-break: break-all;

    /* Acts as a default height, when the table isn't yet full */
    height: 26px;

    background-color: #f3f4f5;
    color: #222;

    &:hover {
        background-color: #fff;
        cursor: pointer;
    }

    > :first-child {
        border-left: 5px solid ${props => getColour((props as any).request.method)};
        border-radius: 3px 0 0 3px;
    }

    > :last-child {
        border-radius: 0 3px 3px 0;
    }
` as any;

const Td = styled.td`
    padding: 5px;
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

const RequestRow = ({ request }: { request: MockttpRequest }) => {
    const url = new URL(request.url);

    return <Tr request={request}>
        <Td className='method'>{request.method}</Td>
        <Td>{truncate(url.host, 30, 4)}</Td>
        <Td>{truncate(url.pathname, 40, 4)}</Td>
        <Td>{truncate(url.search.slice(1), 40)}</Td>
    </Tr>
}

const Overlay = styled.div`
    position: absolute;
    top: 40px;
    bottom: 40px;
    height: auto;
`;

export function RequestList({ requests }: { requests: MockttpRequest[] }) {
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
                        <RequestRow key={i} request={req} />
                    )) }
                    <tr></tr>{/* This fills up empty space at the bottom to stop other rows expanding */}
                </tbody>
            </Table>
            { requests.length === 0 ?
                <Overlay>
                    <EmptyState icon={['far', 'spinner-third']} spin message='Requests will appear here, once you send some...' />
                </Overlay>
                : null }
        </TableScrollContainer>
    </TableRoot>;
}