import * as _ from 'lodash';
import * as React from 'react';

import { observable, action } from 'mobx';
import { observer, inject } from 'mobx-react';

import { styled, FontAwesomeIcon, Icons, IconProps } from '../../styles';

import { LittleCard } from '../card';

import { Store, ServerStatus } from '../../model/store';
import { ConnectedSources } from './connected-sources';

interface InterceptPageProps {
    className?: string,
    store: Store,
}

const MOBILE_TAGS =['mobile', 'phone', 'apple', 'samsung', 'ios', 'android', 'app'];
const DOCKER_TAGS = ['bridge', 'services', 'images'];

interface InterceptorOption {
    id: string;
    name: string;
    description: string;
    iconProps: IconProps;
    tags: string[];
}

const MANUAL_INTERCEPT_OPTION: InterceptorOption = {
    id: 'manual-setup',
    name: 'Manual setup',
    description: 'Manually configure a source with the proxy settings and certificate',
    iconProps: Icons.Unknown,
    tags: []
}

const INTERCEPT_OPTIONS: InterceptorOption[] = [
    {
        id: 'fresh-chrome',
        name: 'Fresh Chrome',
        description: 'Open a preconfigured fresh Chrome window',
        iconProps: Icons.Chrome,
        tags: ['browsers', 'web page']
    },
    {
        id: 'docker-all',
        name: 'All Docker Containers',
        description: 'Intercept all local Docker traffic',
        iconProps: Icons.Docker,
        tags: DOCKER_TAGS
    },
    {
        id: 'docker-specific',
        name: 'Specific Docker Containers',
        description: 'Intercept all traffic from specific Docker containers',
        iconProps: Icons.Docker,
        tags: DOCKER_TAGS
    },
    {
        id: 'network-device',
        name: 'A device on your network',
        description: 'Intercept all HTTP traffic from another device on your network',
        iconProps: Icons.Network,
        tags: [...MOBILE_TAGS, 'lan', 'arp', 'wifi']
    },
    {
        id: 'system-proxy',
        name: 'Everything',
        description: 'Intercept all HTTP traffic on this machine',
        iconProps: Icons.Desktop,
        tags: ['local', 'machine', 'system', 'me']
    },
    MANUAL_INTERCEPT_OPTION
];

const InterceptPageContainer = styled.section`
    display: grid;

    grid-gap: 80px;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    grid-template-rows: 350px;
    grid-auto-rows: 200px;

    max-width: 1200px;
    margin: 0 auto;
    padding: 40px;

    max-height: 100%;
    overflow: auto;

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

const InterceptSearchBox = styled((props: {
    className?: string,
    value: string,
    onChange: (input: string) => void
}) =>
    <div className={props.className}>
        <input
            type='text'
            autoFocus
            value={props.value}
            placeholder='Browsers, mobile, docker...'
            onChange={(e) => props.onChange(e.currentTarget.value.toLocaleLowerCase())}
        />
        <FontAwesomeIcon
            icon={['fas', 'times']}
            size='2x'
            onClick={() => props.onChange('')}
        />
    </div>
)`
    position: relative;
    margin: 20px 0 0;

    > input {
        width: 100%;
        padding: 15px;
        box-sizing: border-box;

        border-radius: 4px;

        border: 1px solid ${p => p.theme.containerBorder};
        box-shadow: inset 0 2px 4px 1px rgba(0, 0, 0, 0.1);
        background-color: ${p => p.theme.popBackground};

        font-size: ${p => p.theme.headingSize};
    }

    > svg {
        position: absolute;

        right: 15px;
        top: 13px;
        cursor: pointer;

        display: none;
    }

    input:not([value=""]) ~ svg {
        display: block;
    }
`;

const InterceptOption = styled(LittleCard)`
    height: 100%;
    width: 100%;

    user-select: none;

    > svg {
        position: absolute;
        bottom: -10px;
        right: -10px;
        z-index: 0;
        opacity: 0.2;
    }

    > :not(svg) {
        z-index: 1;
    }

    > p {
        color: ${p => p.theme.mainColor};
    }
`;

@inject('store')
@observer
class InterceptPage extends React.Component<InterceptPageProps> {

    @observable filter: string | false = false;

    render(): JSX.Element {
        let mainView: JSX.Element | undefined;

        const supportedInterceptorIds = _.map(this.props.store.supportedInterceptors, 'id');

        if (this.props.store.serverStatus === ServerStatus.Connected) {
            const interceptOptions = INTERCEPT_OPTIONS.filter((option) =>
                !this.filter ||
                _.includes(option.name.toLocaleLowerCase(), this.filter) ||
                _.includes(option.description.toLocaleLowerCase(), this.filter) ||
                _.some(option.tags, t => _.includes(t.toLocaleLowerCase(), this.filter))
            );

            if (interceptOptions.length === 0) {
                interceptOptions.push(MANUAL_INTERCEPT_OPTION);
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
                            onChange={this.onSearchInput}
                        />
                    </InterceptInstructions>

                    <ConnectedSources activeSources={this.props.store.activeSources} />

                    { interceptOptions.map((option) =>
                        <InterceptOption
                            disabled={
                                !_.includes(supportedInterceptorIds, option.id) &&
                                option !== MANUAL_INTERCEPT_OPTION
                            }
                            onClick={this.onInterceptorClicked.bind(this, option)}
                            key={option.name}
                            tabIndex={0}
                        >
                            <FontAwesomeIcon
                                {...option.iconProps}
                                size='8x'
                            />
                            <h1>{ option.name }</h1>
                            <p>
                                { option.description }
                            </p>
                        </InterceptOption>
                    ) }
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

    onInterceptorClicked(interceptor: InterceptorOption) {
        this.props.store.activateInterceptor(interceptor.id);
    }

    @action.bound
    onSearchInput(input: string) {
        this.filter = input || false;
    }
}

const StyledInterceptPage = styled(InterceptPage)`
    height: 100vh;
    position: relative;
`;

export { StyledInterceptPage as InterceptPage };