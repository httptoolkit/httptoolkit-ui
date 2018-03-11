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

class App extends React.Component<{
    serverStatus: ServerStatus
}> {
    render(): JSX.Element {
        switch(this.props.serverStatus) {
            case ServerStatus.Connected:
                return (
                    <SplitScreen>
                        <RequestListFromStore></RequestListFromStore>
                        <RequestDetailsPane></RequestDetailsPane>
                    </SplitScreen>
                );
            case ServerStatus.Connecting:
                return <div>Connecting...</div>;
            case ServerStatus.AlreadyInUse:
                return <div>Port already in use</div>;
            case ServerStatus.UnknownError:
                return <div>An unknown error occurred</div>;
        }
    }
}

export const AppContainer = styled(connect((state: StoreModel) => ({
    serverStatus: state.serverStatus
}))(App))`
    height: 100vh;
`;