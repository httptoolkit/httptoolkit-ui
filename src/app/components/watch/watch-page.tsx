import * as React from 'react';
import * as _ from 'lodash';
import { connect } from 'react-redux';

import { styled } from '../../styles';

import { ExchangeList } from './exchange-list';
import { ExchangeDetailsPane } from './exchange-details-pane';
import { SplitPane } from '../split-pane';

import { StoreModel, ServerStatus, HttpExchange, Action } from '../../model/store';
import { Dispatch } from 'redux';

const ExchangeListFromStore = connect<
    // It seems this isn't inferrable? Very odd
    { exchanges: HttpExchange[] },
    { onClear: () => void },
    { onSelected: (exchange: HttpExchange | undefined) => void }
>(
    (state: StoreModel) => ({ exchanges: state.exchanges }),
    (dispatch: Dispatch<Action>) => ({ onClear: () => dispatch({ type: 'ClearExchanges' }) })
)(ExchangeList);

interface WatchPageProps {
    className?: string,
    serverStatus: ServerStatus,
    exchanges: HttpExchange[]
}

interface WatchPageState {
    selectedExchange: HttpExchange | undefined,
}

class WatchPage extends React.PureComponent<WatchPageProps, WatchPageState> {
    constructor(props: WatchPageProps) {
        super(props);

        this.state = {
            selectedExchange: undefined
        };
    }

    static getDerivedStateFromProps(nextProps: WatchPageProps, prevState: WatchPageState) : WatchPageState | null {
        if (!_.includes(nextProps.exchanges, prevState.selectedExchange)) {
            return { selectedExchange: undefined };
        }

        return null;
    }

    render(): JSX.Element {
        let mainView: JSX.Element | undefined;

        if (this.props.serverStatus === ServerStatus.Connected) {
            mainView = (
                <SplitPane
                    split='vertical'
                    primary='second'
                    defaultSize='50%'
                    minSize={300}
                    maxSize={-300}
                >
                    <ExchangeListFromStore onSelected={this.onSelected}></ExchangeListFromStore>
                    <ExchangeDetailsPane exchange={this.state.selectedExchange}></ExchangeDetailsPane>
                </SplitPane>
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

const ConnectedWatchPage = styled(connect((state: StoreModel): WatchPageProps => ({
    serverStatus: state.serverStatus,
    exchanges: state.exchanges
}))(WatchPage))`
    height: 100vh;
    position: relative;
`;

export { ConnectedWatchPage as WatchPage };