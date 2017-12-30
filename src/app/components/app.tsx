import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { Mockttp } from 'mockttp';
import { RequestListContainer } from './request-list-container';
import { MockttpRequest } from '../../types';
import { connect } from 'react-redux';
import { StoreModel } from '../store';

class App extends React.Component<{
    connectedToServer: boolean
}> {
    render() {
        return this.props.connectedToServer ? (
            <RequestListContainer></RequestListContainer>
        ) : (
            <div>Connecting...</div>
        );
    }
}

export const AppContainer = connect((state: StoreModel) => ({
    connectedToServer: state.connectedToServer
}))(App);