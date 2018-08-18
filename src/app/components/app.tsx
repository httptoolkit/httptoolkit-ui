import * as React from 'react';
import { connect } from 'react-redux';
import styled from 'styled-components';

import { ExchangeList } from './exchange-list';
import { ExchangeDetailsPane } from './exchange-details-pane';
import { SplitScreen } from './split-screen';

import { StoreModel, ServerStatus, HttpExchange } from '../model/store';

const ExchangeListFromStore = connect(
    (state: StoreModel) => ({ exchanges: state.exchanges })
)(ExchangeList);

interface AppProps {
    className?: string,
    serverStatus: ServerStatus
}

class App extends React.PureComponent<AppProps, {
    selectedExchange: HttpExchange | undefined
}> {
    constructor(props: AppProps) {
        super(props);

        this.state = {
            selectedExchange: undefined
        };
    }

    render(): JSX.Element {
        let mainView: JSX.Element | undefined;

        if (this.props.serverStatus === ServerStatus.Connected) {
            mainView = (
                <SplitScreen minWidth={300}>
                    <ExchangeListFromStore onSelected={this.onSelected}></ExchangeListFromStore>
                    <ExchangeDetailsPane exchange={this.state.selectedExchange}></ExchangeDetailsPane>
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

    onSelected = (exchange: HttpExchange | undefined) => {
        this.setState({
            selectedExchange: exchange
        });
    }
}

export const AppContainer = styled(connect((state: StoreModel) => ({
    serverStatus: state.serverStatus
}))(App))`
    height: 100vh;
`;