import * as React from 'react';
import * as ReactDOM from 'react-dom';
import styled from 'styled-components';

import { MockttpRequest } from '../types';

const FullWidthTable = styled.table`
    display: block;
    background-color: #eee;
`;

export function RequestList({ requests }: { requests: MockttpRequest[] }) {
    return <FullWidthTable>
        <thead>
            <tr>
                <th>Method</th>
                <th>URL</th>
            </tr>
        </thead>
        <tbody>
            { requests.map((req, i) => (
                <tr key={i}>
                    <td>{req.method}</td>
                    <td>{req.url}</td>
                </tr>
            )) }
        </tbody>
    </FullWidthTable>;
}