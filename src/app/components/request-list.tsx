import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { MockttpRequest } from '../types';

export function RequestList({ requests }: { requests: MockttpRequest[] }) {
    return <ul>
        { requests.map((req, i) => (
            <li key={i}>Request to {req.url}</li>
        )) }
    </ul>;
}