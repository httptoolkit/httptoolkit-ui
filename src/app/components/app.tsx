import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { connect } from 'react-redux';
import styled from 'styled-components';

import { Mockttp } from 'mockttp';

import { RequestList } from './request-list';
import { RequestDetailsPane } from './request-details-pane';
import { SplitScreen } from './split-screen';

import { MockttpRequest } from '../types';
import { StoreModel, ServerStatus } from '../model/store';

const RequestListFromStore = connect(
    (state: StoreModel) => ({ requests: state.requests })
)(RequestList);

interface AppProps {
    className?: string,
    serverStatus: ServerStatus
}

class App extends React.PureComponent<AppProps, {
    selectedRequest: MockttpRequest | undefined
}> {
    constructor(props: AppProps) {
        super(props);

        this.state = {
            selectedRequest: undefined
        };
    }

    render(): JSX.Element {
        let mainView: JSX.Element | undefined;

        if (this.props.serverStatus === ServerStatus.Connected) {
            mainView = (
                <SplitScreen minWidth={300}>
                    <RequestListFromStore onSelected={this.onSelected}></RequestListFromStore>
                    <RequestDetailsPane request={this.state.selectedRequest}></RequestDetailsPane>
                </SplitScreen>
            );
        } else if (this.props.serverStatus === ServerStatus.Connecting) {
            mainView = <div>Connecting...</div>;
        } else if (this.props.serverStatus === ServerStatus.AlreadyInUse) {
            mainView = <div>Port already in use</div>;
        } else if (this.props.serverStatus === ServerStatus.UnknownError) {
            mainView = <div>An unknown error occurred</div>;
        }

        return <div className={this.props.className}>{ mainView }</div>;
    }

    onSelected = (request: MockttpRequest | undefined) => {
        this.setState({
            selectedRequest: request
        });
    }
}

export const AppContainer = styled(connect((state: StoreModel) => ({
    serverStatus: state.serverStatus
}))(App))`
    height: 100vh;
`;