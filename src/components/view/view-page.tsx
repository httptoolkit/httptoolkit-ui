import * as React from 'react';
import * as _ from 'lodash';

import { observable, autorun, action, runInAction } from 'mobx';
import { observer, disposeOnUnmount, inject } from 'mobx-react';

import { HttpExchange, WithInjectedStore } from '../../types';
import { styled } from '../../styles';

import { ExchangeList } from './exchange-list';
import { ExchangeDetailsPane } from './exchange-details-pane';
import { SplitPane } from '../split-pane';

import { Store, ServerStatus } from '../../model/store';

interface ViewPageProps {
    className?: string,
    store: Store
}

@inject('store')
@observer
class ViewPage extends React.Component<ViewPageProps> {

    @observable.ref selectedExchange: HttpExchange | undefined = undefined;

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            if (!_.includes(this.props.store.exchanges, this.selectedExchange)) {
                runInAction(() => this.selectedExchange = undefined);
            }
        }));
    }

    render(): JSX.Element {
        let mainView: JSX.Element | undefined;
        const { serverStatus, exchanges, clearExchanges } = this.props.store;

        if (serverStatus === ServerStatus.Connected) {
            mainView = (
                <SplitPane
                    split='vertical'
                    primary='second'
                    defaultSize='50%'
                    minSize={300}
                    maxSize={-300}
                >
                    <ExchangeList
                        onSelected={this.onSelected}
                        onClear={clearExchanges}
                        exchanges={exchanges}
                    />
                    <ExchangeDetailsPane exchange={this.selectedExchange}></ExchangeDetailsPane>
                </SplitPane>
            );
        } else if (serverStatus === ServerStatus.Connecting) {
            mainView = <div>Connecting...</div>;
        } else if (serverStatus === ServerStatus.AlreadyInUse) {
            mainView = <div>Port already in use</div>;
        } else if (serverStatus === ServerStatus.UnknownError) {
            mainView = <div>An unknown error occurred</div>;
        }

        return <div className={this.props.className}>{ mainView }</div>;
    }

    @action.bound
    onSelected(exchange: HttpExchange | undefined) {
        this.selectedExchange = exchange;
    }
}

const StyledViewPage = styled(
    // Exclude store from the external props, as it's injected
    ViewPage as unknown as WithInjectedStore<typeof ViewPage>
)`
    height: 100vh;
    position: relative;
`;

export { StyledViewPage as ViewPage };