import * as React from 'react';
import * as ReactDOM from 'react-dom';
import styled, { css } from 'styled-components';

import { MockttpRequest } from '../types';

const FullWidthTable = styled.table`
    display: block;
    background-color: #eee;
`;

const CellBase = css`
    padding: 5px;
`;

const Tr = styled.tr`
    ${CellBase}
`;

const Th = styled.th`
    ${CellBase}
`;

const Td = styled.td`
    ${CellBase}
`;

export function RequestList({ requests }: { requests: MockttpRequest[] }) {
    return <FullWidthTable>
        <thead>
            <Tr>
                <Th>Method</Th>
                <Th>URL</Th>
            </Tr>
        </thead>
        <tbody>
            { requests.map((req, i) => (
                <Tr key={i}>
                    <Td>{req.method}</Td>
                    <Td>{req.url}</Td>
                </Tr>
            )) }
        </tbody>
    </FullWidthTable>;
}