import * as React from 'react';
import * as ReactDOM from 'react-dom';
import styled, { css } from 'styled-components';

import { MockttpRequest } from '../types';

const FullSizeTable = styled.table`
    width: 100%;
    height: 100%;

    background-color: #1c324a;
    color: #eee;

    font-size: 14px;

    border-collapse: separate;
    border-spacing: 0 3px;
    margin-top: -3px;
`;

const CellBase = css`
    padding: 5px;
`;

const TBody = styled.tbody`
    &:empty {
        display: block;
    }
`;

const Tr = styled.tr`
    ${CellBase}
    width: 100%;
    word-break: break-all;

    /* Acts as a default height, when the table isn't yet full */
    height: 26px;

    background-color: rgba(255, 255, 255, 0.8);
    color: #222;

    &:hover {
        background-color: rgba(255, 255, 255, 0.85);
        cursor: pointer;
    }

    :first-child {
        border-left: 3px solid #1c324a;
    }
`;

const Th = styled.th`
    ${CellBase}
`;

const Td = styled.td`
    ${CellBase}

    &.method {
        white-space: nowrap;
        font-weight: 800;
    }
`;

const TFoot = styled.tfoot`
    height: auto;
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

    return <Tr>
        <Td className='method'>{request.method}</Td>
        <Td>{truncate(url.host, 30, 4)}</Td>
        <Td>{truncate(url.pathname, 40, 4)}</Td>
        <Td>{truncate(url.search.slice(1), 40)}</Td>
    </Tr>
}

export function RequestList({ requests }: { requests: MockttpRequest[] }) {
    return <FullSizeTable>
        <thead>
            <Tr>
                <Th>Method</Th>
                <Th>Host</Th>
                <Th>Path</Th>
                <Th>Params</Th>
            </Tr>
        </thead>
        <TBody>
            { requests.map((req, i) => (
                <RequestRow key={i} request={req} />
            )) }
            <tr></tr>
        </TBody>
        <TFoot><tr></tr></TFoot>
    </FullSizeTable>;
}