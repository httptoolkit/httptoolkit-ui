import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { Mockttp } from 'mockttp';
import { RequestList } from './request-list';
import { MockttpRequest } from '../../types';

export class Main extends React.Component<{
    server: Mockttp
}, {
    connectedToServer: boolean,
    requests: MockttpRequest[]
}> {

    constructor(
        props: { server: Mockttp },
        context: {}
    ) {
        super(props, context);

        this.state = {
            connectedToServer: false,
            requests: []
        };
    }

    async componentDidMount() {
        const { server } = this.props;
        await server.start()

        this.setState({ connectedToServer: true });
        console.log(`Server started on port ${server.port}`);

        await server.get('/').thenReply(200, 'Running!');
        await server.anyRequest().always().thenPassThrough();

        server.on('request', (req) => {
            this.setState({
                requests: this.state.requests.concat(req)
            });
        });
    }

    componentWillUnmount() {
        return this.props.server.stop();
    }

    render() {
        return this.state.connectedToServer ? (
            <RequestList requests={this.state.requests}></RequestList>
        ) : (
            <div>Connecting...</div>
        );
    }
}