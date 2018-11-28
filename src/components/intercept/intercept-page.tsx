import * as _ from 'lodash';
import * as React from 'react';

import { observable, action, flow } from 'mobx';
import { observer, inject } from 'mobx-react';

import { styled } from '../../styles';

import { Store, ServerStatus } from '../../model/store';
import { ConnectedSources } from './connected-sources';
import { InterceptOption } from './intercept-option';
import { SearchBox } from '../common/search-box';
import { WithInjectedStore } from '../../types';
import { trackEvent } from '../../tracking';
import { MANUAL_INTERCEPT_ID, Interceptor } from '../../model/interceptors';

interface InterceptPageProps {
    className?: string,
    store: Store,
}

const InterceptPageContainer = styled.section`
    display: grid;

    grid-gap: 80px;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    grid-template-rows: 350px;
    grid-auto-rows: 200px;

    max-width: 1200px;
    margin: 0 auto 20px;
    padding: 40px;

    > ${ConnectedSources} {
        grid-column: 3 / span 2;
        overflow-y: auto;
    }
`;

const InterceptInstructions = styled.div`
    grid-column: 1 / span 2;

    display: flex;
    flex-direction: column;
    justify-content: flex-end;

    > h1 {
        font-size: ${p => p.theme.loudHeadingSize};
        font-weight: bold;
        margin-bottom: 40px;
    }

    > p {
        font-size: ${p => p.theme.headingSize};

        margin-bottom: 20px;
        text-align: left;
    }
`;

const InterceptSearchBox = styled(SearchBox).attrs({
    autoFocus: true,
    placeholder: 'Browsers, mobile, docker...',
    iconSize: '2x'
})`
    margin: 20px 0 0;
`;

@inject('store')
@observer
class InterceptPage extends React.Component<InterceptPageProps> {

    @observable filter: string | false = false;

    render(): JSX.Element {
        let mainView: JSX.Element | undefined;

        const interceptOptions = this.props.store.interceptors;

        if (this.props.store.serverStatus === ServerStatus.Connected) {
            const visibleInterceptOptions = _.pickBy(interceptOptions, (option) =>
                !this.filter ||
                _.includes(option.name.toLocaleLowerCase(), this.filter) ||
                _.includes(option.description.toLocaleLowerCase(), this.filter) ||
                _.some(option.tags, t => _.includes(t.toLocaleLowerCase(), this.filter))
            );

            if (!_.some(visibleInterceptOptions, (o) => o.isActivable)) {
                visibleInterceptOptions[MANUAL_INTERCEPT_ID] = interceptOptions[MANUAL_INTERCEPT_ID];
            }

            mainView = (
                <InterceptPageContainer>
                    <InterceptInstructions>
                        <h1>
                            Intercept HTTP
                        </h1>
                        <p>
                            To collect & view HTTP traffic, you need to connect
                            a source of traffic, like a browser, mobile device, or
                            docker container.
                        </p>
                        <p>
                            Click an option below to connect a traffic source, or
                            search for connectors that could work for you:
                        </p>
                        <InterceptSearchBox
                            value={this.filter || ''}
                            onSearch={this.onSearchInput}
                        />
                    </InterceptInstructions>

                    <ConnectedSources activeSources={this.props.store.activeSources} />

                    { _(visibleInterceptOptions)
                        .sortBy((option) => {
                            if (option.isActive) return -100;
                            else if (option.isActivable) return -50;
                            else if (option.isSupported) return -25;
                            else return 0;
                        })
                        .map((option, id) =>
                            <InterceptOption
                                key={id}
                                interceptor={option}
                                onActivate={this.onInterceptorActivated.bind(this)}
                            />
                    ).value() }
                </InterceptPageContainer>
            );
        } else if (this.props.store.serverStatus === ServerStatus.Connecting) {
            mainView = <div>Connecting...</div>;
        } else if (this.props.store.serverStatus === ServerStatus.AlreadyInUse) {
            mainView = <div>Port already in use</div>;
        } else if (this.props.store.serverStatus === ServerStatus.UnknownError) {
            mainView = <div>An unknown error occurred</div>;
        }

        return <div className={this.props.className}>{ mainView }</div>;
    }

    onInterceptorActivated = flow(function * (this: InterceptPage, interceptor: Interceptor) {
        trackEvent({ category: 'Interceptors', action: 'Activated', label: interceptor.id });
        interceptor.inProgress = true;
        yield this.props.store.activateInterceptor(interceptor.id);
        interceptor.inProgress = false;
    });

    @action.bound
    onSearchInput(input: string) {
        this.filter = input || false;
    }
}

const StyledInterceptPage = styled(
    // Exclude store from the external props, as it's injected
    InterceptPage as unknown as WithInjectedStore<typeof InterceptPage>
)`
    height: 100%;
    overflow-y: auto;
    position: relative;
`;

export { StyledInterceptPage as InterceptPage };