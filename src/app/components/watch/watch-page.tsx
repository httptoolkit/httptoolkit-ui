import * as React from 'react';
import * as _ from 'lodash';

import { observable, autorun } from 'mobx';
import { observer, disposeOnUnmount } from 'mobx-react';

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

@observer
class WatchPage extends React.Component<WatchPageProps> {

    @observable.ref selectedExchange: HttpExchange | undefined = undefined;

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            if (!_.includes(this.props.exchanges, this.selectedExchange)) {
                this.selectedExchange = undefined;
            }
        }));
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
                    <ExchangeDetailsPane exchange={this.selectedExchange}></ExchangeDetailsPane>
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
        this.selectedExchange = exchange;
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