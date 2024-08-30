import * as _ from 'lodash';
import * as React from 'react';

import { observable, action } from 'mobx';
import { observer, inject } from 'mobx-react';

import { WithInjected } from '../../types';
import { NARROW_LAYOUT_BREAKPOINT, styled } from '../../styles';

import { InterceptorStore } from '../../model/interception/interceptor-store';
import { EventsStore } from '../../model/events/events-store';
import { MANUAL_INTERCEPT_ID } from '../../model/interception/interceptors';

import { ConnectedSources } from './connected-sources';
import { InterceptOption } from './intercept-option';
import { TextInput } from '../common/inputs';
import { IconButton } from '../common/icon-button';

interface InterceptPageProps {
    className?: string;
    interceptorStore: InterceptorStore;
    eventsStore: EventsStore;
    navigate: (path: string) => void;
}

const InterceptPageContainer = styled.section`
    display: grid;

    @media (min-width: ${NARROW_LAYOUT_BREAKPOINT}px) {
        grid-gap: 40px;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        grid-template-rows: 320px;
        padding: 60px 40px;
    }

    @media not (min-width: ${NARROW_LAYOUT_BREAKPOINT}px) {
        grid-gap: 20px;
        grid-template-columns: 1fr 1fr 1fr;
        padding: 40px;
    }

    grid-auto-rows: minmax(210px, auto);
    grid-auto-flow: row dense;

    max-width: 1200px;
    margin: 0 auto 20px;

    > ${ConnectedSources} {
        @media not (min-width: ${NARROW_LAYOUT_BREAKPOINT}px) {
            display: none;
        }

        order: -1;
        grid-column: 3 / span 2;
        overflow-y: auto;
        margin-bottom: 0;
    }
`;

const InterceptInstructions = styled.div`
    order: -1;

    @media (min-width: ${NARROW_LAYOUT_BREAKPOINT}px) {
        grid-column: 1 / span 2;
    }

    @media not (min-width: ${NARROW_LAYOUT_BREAKPOINT}px) {
        grid-column: 1 / -1;
    }

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
        line-height: 1.2;
    }
`;

const SearchInput = styled(TextInput)`
    width: 100%;
    padding: 15px;
    box-sizing: border-box;

    box-shadow: inset 0 2px 4px 1px rgba(0, 0, 0, ${p => p.theme.boxShadowAlpha / 2});

    font-size: ${p => p.theme.headingSize};
`;

const ClearSearchButton = styled(IconButton)`
    position: absolute;

    right: 15px;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
`;

const SearchBox = styled((props: {
    className?: string,
    value: string,
    onSearch: (input: string) => void
}) =>
    <div className={props.className}>
        <SearchInput
            autoFocus={true}
            value={props.value}
            placeholder='Browsers, mobile, docker...'
            aria-label='Filter the list of intercept options below'
            onChange={(e) => props.onSearch(e.currentTarget.value)}
        />
        { !!props.value &&
            <ClearSearchButton
                icon={['fas', 'times']}
                iconSize={'2x'}
                onClick={() => props.onSearch('')}
                title='Clear search input'
            />
        }
    </div>
)`
    position: relative;

    @media (min-width: ${NARROW_LAYOUT_BREAKPOINT}px) {
        margin: 20px 0 0;
    }
`;

@inject('interceptorStore')
@inject('eventsStore')
@observer
class InterceptPage extends React.Component<InterceptPageProps> {

    @observable filter: string | false = false;

    private readonly gridRef = React.createRef<HTMLDivElement>();

    render(): JSX.Element {
        const { interceptors } = this.props.interceptorStore;
        const { activeSources } = this.props.eventsStore;

        const filter = this.filter ? this.filter.toLocaleLowerCase() : false;

        const visibleInterceptOptions = _.pickBy(interceptors, (option) =>
            !filter ||
            _.includes(option.name.toLocaleLowerCase(), filter) ||
            _.includes(option.description.join(' ').toLocaleLowerCase(), filter) ||
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
                        To collect &amp; view HTTP traffic, you need to connect
                        a source of traffic, like a browser, mobile device, or
                        docker container.
                    </p>
                    <p>
                        Click an option below to connect a traffic source, or
                        search for connectors that could work for you:
                    </p>
                    <SearchBox
                        value={this.filter || ''}
                        onSearch={this.onSearchInput}
                    />
                </InterceptInstructions>

                <ConnectedSources activeSources={activeSources} />

                { _(visibleInterceptOptions)
                    .sortBy((option) => {
                        const exactFilterMatch = filter && (
                            option.tags.includes(filter) ||
                            option.name.toLocaleLowerCase().split(' ').includes(filter)
                        );

                        return -1 * (0 +
                            (exactFilterMatch ? 100 : 0) +
                            (option.isActive || option.isActivable ? 50 : 0) +
                            (option.isSupported ? 25 : 0)
                        );
                    })
                    .map((option, index) =>
                        <InterceptOption
                            key={option.id}
                            index={index}
                            interceptor={option}
                            showRequests={this.showRequests}
                        />
                    ).value()
                }
            </InterceptPageContainer>
        </div>;
    }

    @action.bound
    showRequests() {
        this.props.navigate('/view');
    }

    @action.bound
    onSearchInput(input: string) {
        this.filter = input || false;
    }
}

const StyledInterceptPage = styled(
    // Exclude store from the external props, as it's injected
    InterceptPage as unknown as WithInjected<typeof InterceptPage, 'interceptorStore' | 'eventsStore' | 'navigate'>
)`
    height: 100%;
    overflow-y: auto;
    position: relative;
`;

export { StyledInterceptPage as InterceptPage };