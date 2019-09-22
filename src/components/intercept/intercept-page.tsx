import * as _ from 'lodash';
import * as React from 'react';

import { observable, action, flow } from 'mobx';
import { observer, inject } from 'mobx-react';

import { styled } from '../../styles';

import { ActivatedStore } from '../../model/interception-store';
import { ConnectedSources } from './connected-sources';
import { InterceptOption } from './intercept-option';
import { SearchBox } from '../common/search-box';
import { WithInjected } from '../../types';
import { trackEvent } from '../../tracking';
import { MANUAL_INTERCEPT_ID, Interceptor } from '../../model/interceptors';
import { ManualInterceptOption } from './manual-intercept-config';
import { reportError } from '../../errors';

interface InterceptPageProps {
    className?: string;
    interceptionStore: ActivatedStore;
    navigate: (path: string) => void;
}

const InterceptPageContainer = styled.section`
    display: grid;

    grid-gap: 80px;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    grid-template-rows: 350px;
    grid-auto-rows: minmax(200px, auto);

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

@inject('interceptionStore')
@observer
class InterceptPage extends React.Component<InterceptPageProps> {

    @observable filter: string | false = false;

    private readonly gridRef = React.createRef<HTMLDivElement>();

    render(): JSX.Element {
        const { serverPort, certPath, activeSources, interceptors } = this.props.interceptionStore;

        const filter = this.filter ? this.filter.toLocaleLowerCase() : false;

        const visibleInterceptOptions = _.pickBy(interceptors, (option) =>
            !filter ||
            _.includes(option.name.toLocaleLowerCase(), filter) ||
            _.includes(option.description.toLocaleLowerCase(), filter) ||
            _.some(option.tags, t => _.includes(t.toLocaleLowerCase(), filter))
        );

        if (!_.some(visibleInterceptOptions, (o) => o.isActivable)) {
            visibleInterceptOptions[MANUAL_INTERCEPT_ID] = interceptors[MANUAL_INTERCEPT_ID];
        }

        return <div className={this.props.className}>
            <InterceptPageContainer ref={this.gridRef}>
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

                <ConnectedSources activeSources={activeSources} />

                { _(visibleInterceptOptions)
                    .sortBy((option) => {
                        if (option.isActive || option.isActivable) return -50;
                        else if (option.isSupported) return -25;
                        else return 0;
                    })
                    .map((option, index) =>
                        // TODO: This is fine for now, but in future we definitely need a generic
                        // activateAction for interceptors, and to move this into the option.
                        (option.id === MANUAL_INTERCEPT_ID) ?
                            <ManualInterceptOption
                                key={option.id}
                                interceptor={option}
                                index={index}
                                serverPort={serverPort}
                                certPath={certPath}
                            />
                        :
                            <InterceptOption
                                key={option.id}
                                interceptor={option}
                                onActivate={this.onInterceptorActivated.bind(this)}
                            />
                ).value() }
            </InterceptPageContainer>
        </div>;
    }

    onInterceptorActivated = flow(function * (this: InterceptPage, interceptor: Interceptor) {
        trackEvent({ category: 'Interceptors', action: 'Activated', label: interceptor.id });
        interceptor.inProgress = true;
        const successful: boolean = yield this.props.interceptionStore.activateInterceptor(interceptor.id);
        interceptor.inProgress = false;

        if (successful) this.props.navigate('/view');
        if (!successful && interceptor.isSupported) {
            reportError(`Failed to launch interceptor ${interceptor.id}`);
        }
    });

    @action.bound
    onSearchInput(input: string) {
        this.filter = input || false;
    }
}

const StyledInterceptPage = styled(
    // Exclude store from the external props, as it's injected
    InterceptPage as unknown as WithInjected<typeof InterceptPage, 'interceptionStore' | 'navigate'>
)`
    height: 100%;
    overflow-y: auto;
    position: relative;
`;

export { StyledInterceptPage as InterceptPage };