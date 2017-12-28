import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { MockttpRequest } from '../../types';

export class RequestList extends React.Component<{
    requests: MockttpRequest[]
}> {
    render() {
        return <ul>
            { this.props.requests.map((req, i) => (
                <li key={i}>Request to {req.url}</li>
            )) }
        </ul>;
    }
}