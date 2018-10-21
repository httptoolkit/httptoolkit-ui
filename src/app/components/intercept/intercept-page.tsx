import * as _ from 'lodash';
import * as React from 'react';
import { connect } from 'react-redux';

import { styled, FontAwesomeIcon, IconProps } from '../../styles';

import { StoreModel, ServerStatus } from '../../model/store';

interface InterceptPageProps {
    className?: string,
    serverStatus: ServerStatus,
}

const MOBILE_TAGS =['mobile', 'phone', 'apple', 'samsung', 'ios', 'android', 'app'];
const DOCKER_TAGS = ['bridge', 'services', 'images'];

const MANUAL_INTERCEPT_OPTION = {
    name: 'Manual setup',
    description: 'Manually configure a source with the proxy settings and certificate',
    iconProps: IconProps.Unknown,
    tags: []
}

const INTERCEPT_OPTIONS = [
    {
        name: 'Fresh Chrome',
        description: 'Open a preconfigured fresh Chrome window',
        iconProps: IconProps.Chrome,
        tags: ['browsers', 'web page']
    },
    {
        name: 'All Docker Containers',
        description: 'Intercept all local Docker traffic',
        iconProps: IconProps.Docker,
        tags: DOCKER_TAGS
    },
    {
        name: 'Specific Docker Containers',
        description: 'Intercept all traffic from specific Docker containers',
        iconProps: IconProps.Docker,
        tags: DOCKER_TAGS
    },
    {
        name: 'A device on your network',
        description: 'Intercept all HTTP traffic from another device on your network',
        iconProps: IconProps.Network,
        tags: [...MOBILE_TAGS, 'lan', 'arp', 'wifi']
    },
    {
        name: 'Everything',
        description: 'Intercept all HTTP traffic on this machine',
        iconProps: IconProps.Desktop,
        tags: ['local', 'machine', 'system', 'me']
    },
    MANUAL_INTERCEPT_OPTION
];

const InterceptPageContainer = styled.section`
    display: grid;

    grid-gap: 80px;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    grid-template-rows: auto;
    grid-auto-rows: 200px;

    max-width: 1200px;
    margin: 0 auto;
    padding: 40px;

    max-height: 100%;
    overflow: auto;
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

const ConnectedSources = styled.div`
    grid-column: 3 / span 2;

    height: 100%;
    width: 100%;
    padding: 15px;
    box-sizing: border-box;

    background-color: ${p => p.theme.mainBackground};
    border: 1px solid ${p => p.theme.containerBorder};
    border-radius: 4px;
    box-shadow: 0 2px 10px 0 rgba(0,0,0,0.2);
`;

const InterceptOption = styled.section`
    height: 100%;
    width: 100%;
    padding: 15px;
    box-sizing: border-box;

    background-color: ${p => p.theme.mainBackground};
    border: 1px solid ${p => p.theme.containerBorder};
    border-radius: 4px;
    box-shadow: 0 2px 10px 0 rgba(0,0,0,0.2);

    cursor: pointer;
    user-select: none;

    overflow: hidden;
    position: relative;
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

    > h1 {
        font-size: ${p => p.theme.headingSize};
        font-weight: bold;
    }

    > p {
        color: ${p => p.theme.mainColor};
        margin-top: 15px;
    }
`;

class InterceptPage extends React.PureComponent<InterceptPageProps, {
    filter: string | false
}> {
    constructor(props: InterceptPageProps) {
        super(props);

        this.state = {
            filter: false
        };
    }

    render(): JSX.Element {
        const { filter } = this.state;

        let mainView: JSX.Element | undefined;

        if (this.props.serverStatus === ServerStatus.Connected) {
            const interceptOptions = INTERCEPT_OPTIONS.filter((option) =>
                !filter ||
                _.includes(option.name.toLocaleLowerCase(), filter) ||
                _.includes(option.description.toLocaleLowerCase(), filter) ||
                _.some(option.tags, t => _.includes(t.toLocaleLowerCase(), filter))
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
                            value={filter || ''}
                            onChange={this.onSearchInput}
                        />
                    </InterceptInstructions>

                    <ConnectedSources>
                        Connected sources:
                    </ConnectedSources>

                    { interceptOptions.map((option) =>
                        <InterceptOption tabIndex={0}>
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
        } else if (this.props.serverStatus === ServerStatus.Connecting) {
            mainView = <div>Connecting...</div>;
        } else if (this.props.serverStatus === ServerStatus.AlreadyInUse) {
            mainView = <div>Port already in use</div>;
        } else if (this.props.serverStatus === ServerStatus.UnknownError) {
            mainView = <div>An unknown error occurred</div>;
        }

        return <div className={this.props.className}>{ mainView }</div>;
    }

    onSearchInput = (input: string) => {
        this.setState({ filter: input || false });
    }
}

const ConnectedInterceptPage = styled(connect((state: StoreModel): InterceptPageProps => ({
    serverStatus: state.serverStatus
}))(InterceptPage))`
    height: 100vh;
    position: relative;
`;

export { ConnectedInterceptPage as InterceptPage };