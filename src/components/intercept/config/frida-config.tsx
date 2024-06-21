import * as _ from 'lodash';
import * as React from 'react';
import { computed, observable, action, autorun, flow, runInAction } from 'mobx';
import { observer, inject, disposeOnUnmount } from 'mobx-react';

import { delay } from '../../../util/promise';
import { ErrorLike, UnreachableCheck } from '../../../util/error';
import { styled } from '../../../styles';
import { Icon } from '../../../icons';

import { Interceptor } from '../../../model/interception/interceptors';
import { ProxyStore } from '../../../model/proxy-store';
import { AccountStore } from '../../../model/account/account-store';
import { EventsStore } from '../../../model/events/events-store';
import { RulesStore } from '../../../model/rules/rules-store';
import { FridaActivationOptions, FridaHost, FridaTarget } from '../../../model/interception/frida';

import { getDetailedInterceptorMetadata } from '../../../services/server-api';
import { ActivationFailure } from '../../../services/server-api-types';

import { TextInput } from '../../common/inputs';
import { InterceptionTargetList } from './intercept-target-list';
import { IconButton } from '../../common/icon-button';

const ConfigContainer = styled.div`
    user-select: text;

    height: 100%;
    max-height: 410px;
    display: flex;
    flex-direction: column;
    justify-content: start;

    margin: 5px -15px -15px -15px;
    width: calc(100% + 30px);

    > p {
        line-height: 1.2;

        &:not(:last-child) {
            margin-bottom: 5px;
        }

        &:not(:first-child) {
            margin-top: 5px;
        }
    }

    a[href] {
        color: ${p => p.theme.linkColor};

        &:visited {
            color: ${p => p.theme.visitedLinkColor};
        }
    }
`;

const FridaTargetList = styled(InterceptionTargetList)`
    padding: 10px 0;
    margin: 0;
    max-height: unset;
`;

const SelectedHostBlock = styled.div`
    display: flex;
    flex-direction: row;
    align-items: stretch;

    z-index: 1;
    box-shadow: 0 0 5px 2px rgba(0,0,0,${p => p.theme.boxShadowAlpha});

    background-color: ${p => p.theme.highlightBackground};
    color: ${p => p.theme.highlightColor};
`;

const SelectedHostName = styled.h2`
    height: 34px;
    flex-grow: 1;

    line-height: 32px;
    text-align: center;

    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
`;

const BackButton = styled(IconButton).attrs(() => ({
    icon: ['fas', 'arrow-left'],
    title: 'Jump to this request on the View page'
}))`
    font-size: ${p => p.theme.textSize};
    color: ${p => p.theme.highlightColor};
    padding: 0 10px;
`;

// Spacer - used to center align the name despite the back button
const NameSpacer = styled.div`
    flex-basis: 34px;
    flex-shrink: 999;
    min-width: 5px;
`;

const SearchBox = styled(TextInput)`
    border-style: solid;
    border-width: 1px 0 1px 0;
    border-color: ${p => p.theme.inputHoverBackground};
    border-radius: 0;

    padding: 10px 10px 8px;

    z-index: 0;
    box-shadow: 0 0 5px 2px rgba(0,0,0,${p => p.theme.boxShadowAlpha});

    :focus {
        outline: none;
        border-color: ${p => p.theme.inputBorder};
    }
`;

const HostName = styled.p`
    font-weight: bold;
`;

const getStateDescriptionText = ({ type, state }: {
    type: FridaHost['type'],
    state: Exclude<FridaHost['state'], 'available'>
}) => {
    if (state === 'launch-required') return 'Frida launch required';
    else if (state === 'setup-required') return 'Frida installation required';
    else if (state === 'unavailable') {
        if (type === 'android') {
            return 'Root access not available';
        } else {
            return 'Device must be jailbroken and running Frida server';
        }
    }

    throw new UnreachableCheck(state);
};

const StateDescription = styled(({ type, state, className }: {
    type: FridaHost['type'],
    state: FridaHost['state'],
    className?: string
}) => {
    if (state === 'available') return null;

    return <p className={className}>
        { getStateDescriptionText({ type, state }) }
    </p>;
})`
    margin-top: 5px;
    font-style: italic;

    white-space: normal;
    text-wrap: balance;
`;

// We actively hide specific known non-interceptable apps:
const INCOMPATIBLE_APP_IDS: string[] = [
    "com.apple.mobilesafari",
    "com.google.android.googlequicksearchbox"
];

const alertActivationError = (action: string, error: ErrorLike) => {
    if (error instanceof ActivationFailure) {
        alert(`Failed to ${action}: ${error.failureMessage} (${error.errorCode})`);
    } else {
        alert(`Failed to ${action}: ${error.message ?? error}`);
    }

    throw error;
};

@inject('proxyStore')
@inject('rulesStore')
@inject('eventsStore')
@inject('accountStore')
@observer
class FridaConfig extends React.Component<{
    proxyStore?: ProxyStore,
    rulesStore?: RulesStore,
    eventsStore?: EventsStore,
    accountStore?: AccountStore,

    interceptor: Interceptor,
    activateInterceptor: (options: FridaActivationOptions) => Promise<void>,
    reportStarted: (options?: { idSuffix?: string }) => void,
    reportSuccess: (options?: { idSuffix?: string, showRequests?: boolean }) => void,
    closeSelf: () => void
}> {

    @computed private get fridaHosts(): Record<string, FridaHost> {
        return this.props.interceptor.metadata?.hosts || {};
    }

    @observable fridaTargets: Array<FridaTarget> = [];

    updateTargets = flow(function * (this: FridaConfig) {
        if (!this.selectedHost) {
            this.fridaTargets = [];
            return;
        }

        const result: {
            targets: FridaTarget[]
        } | undefined = (
            yield getDetailedInterceptorMetadata(this.props.interceptor.id, this.selectedHost?.id)
        );

        this.fridaTargets = result?.targets?.filter(
            target => !INCOMPATIBLE_APP_IDS.includes(target.id)
        ) ?? [];
    }.bind(this));

    @observable private inProgressTargetIds: string[] = [];
    @observable private hostProgress: { [hostId: string]: number } = {};

    @action
    setHostProgress(hostId: string, progress: number | undefined) {
        if (progress === undefined) {
            delete this.hostProgress[hostId];
        } else {
            this.hostProgress[hostId] = progress;
        }
    }

    async componentDidMount() {
        // Auto-open the first host, if there's only one:
        const hosts = Object.values(this.fridaHosts);
        if (hosts.length === 1 && hosts[0].state === 'available') {
            this.selectHost(hosts[0].id);
        }

        disposeOnUnmount(this, autorun(() => {
            // If the selected host disappears or becomes unavailable, deselect it:
            if (
                this.selectedHostId &&
                this.fridaHosts[this.selectedHostId]?.state !== 'available'
            ) {
                this.deselectHost();
            }

            if (Object.keys(this.fridaHosts).length === 0) {
                this.props.closeSelf();
            }
        }));

        this.updateTargets();
        const updateInterval = setInterval(this.updateTargets, 2000);
        disposeOnUnmount(this, () => clearInterval(updateInterval));
    }

    @computed
    get deviceClassName() {
        const interceptorId = this.props.interceptor.id;
        if (interceptorId === 'android-frida') {
            return 'Android';
        } else if (interceptorId === 'ios-frida') {
            return 'iOS';
        } else {
            throw new Error(`Unknown Frida interceptor type: ${interceptorId}`);
        }
    }

    @observable selectedHostId: string | undefined;

    @computed
    get selectedHost() {
        if (!this.selectedHostId) return;

        const host = this.getHost(this.selectedHostId);
        if (host?.state === 'unavailable') return;

        return host;
    }

    private getHost(hostId: string) {
        return this.fridaHosts[hostId];
    }

    @action.bound
    async selectHost(hostId: string) {
        const host = this.getHost(hostId);

        if (host?.state === 'available') {
            this.viewHostTargets(hostId);
            return;
        }

        // Do nothing if the host is already busy:
        if (this.hostProgress[hostId] !== undefined) return;

        this.hostProgress[hostId] = 10;

        if (host?.state === 'launch-required') {
            await this.launchInterceptor(hostId);
        } else if (host?.state === 'setup-required') {
            await this.setupInterceptor(hostId);
        } else {
            // Should probably never happen, but maybe in some race conditions
            return;
        }
    }

    @action.bound
    deselectHost() {
        this.selectedHostId = undefined;
    }

    @action
    viewHostTargets(hostId: string) {
        this.selectedHostId = hostId;
        this.searchInput = '';
        this.updateTargets();
    }

    async setupInterceptor(hostId: string) {
        // Logarithmically move towards 75% while setup runs:
        let interval = setInterval(() => {
            const currentProgress = this.hostProgress[hostId];
            const remaining = 74 - currentProgress;
            this.setHostProgress(hostId,
                currentProgress + Math.floor(remaining / 10)
            );
        }, 100);

        try {
            this.props.reportStarted({ idSuffix: 'setup' });
            await this.props.activateInterceptor({
                action: 'setup',
                hostId
            }).catch((e) => alertActivationError('setup Frida', e));
            this.props.reportSuccess({ idSuffix: 'setup', showRequests: false });

            this.setHostProgress(hostId, 75);
            await this.launchInterceptor(hostId);
        } finally {
            clearInterval(interval);
            this.setHostProgress(hostId, undefined);
        }
    }

    async launchInterceptor(hostId: string) {
        // Logarithmically move towards 100% while setup runs:
        let interval = setInterval(() => {
            const currentProgress = this.hostProgress[hostId];
            const remaining = 99 - currentProgress;
            this.setHostProgress(hostId,
                currentProgress + Math.floor(remaining / 5)
            );
        }, 100);

        try {
            this.props.reportStarted({ idSuffix: 'launch' });
            await this.props.activateInterceptor({
                action: 'launch',
                hostId
            }).catch((e) => alertActivationError('launch Frida', e));
            this.props.reportSuccess({ idSuffix: 'launch', showRequests: false });

            this.setHostProgress(hostId, 100);
            await delay(10); // Tiny delay, purely for nice UI purposes

            // When launch succeeds, it guarantees that the current state is now available.
            // We directly check that, rather than waiting for the next metadata update:
            runInAction(() => {
                this.props.interceptor.metadata!.hosts[hostId].state = 'available';
            });

            if (Object.values(this.hostProgress).length === 1) { // Don't jump if setting up multiple devices
                this.viewHostTargets(hostId);
            }
        } finally {
            clearInterval(interval);
            this.setHostProgress(hostId, undefined);
        }
    }

    @action.bound
    interceptTarget(targetId: string) {
        const host = this.selectedHost;

        if (!host) return;

        this.inProgressTargetIds.push(targetId);
        this.props.reportStarted({ idSuffix: 'app' });
        this.props.activateInterceptor({
            action: 'intercept',
            hostId: host.id,
            targetId
        })
        .catch((e) => alertActivationError(`intercept ${targetId}`, e))
        .then(() => {
            this.props.reportSuccess({ idSuffix: 'app', showRequests: true });
        }).finally(action(() => {
            _.pull(this.inProgressTargetIds, targetId);
        }));
    }

    @observable searchInput: string = '';

    @action.bound
    onSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.searchInput = event.currentTarget.value;
    }

    render() {
        const selectedHost = this.selectedHost;

        if (selectedHost) {
            const lowercaseSearchInput = this.searchInput.toLowerCase();
            const targets = _.sortBy(
                this.fridaTargets
                .filter(({ name }) => name.toLowerCase().includes(lowercaseSearchInput)),
                (target) => target.name.toLowerCase()
            );

            const allResultsFiltered = this.fridaTargets.length > 0 && targets.length === 0;

            return <ConfigContainer>
                <SelectedHostBlock>
                    <BackButton onClick={this.deselectHost} />
                    <SelectedHostName>{ selectedHost.name }</SelectedHostName>
                    <NameSpacer />
                </SelectedHostBlock>
                <SearchBox
                    value={this.searchInput}
                    onChange={this.onSearchChange}
                    placeholder='Search for a target...'
                    autoFocus={true}
                />
                <FridaTargetList
                    spinnerText={
                        allResultsFiltered
                        ? `No '${this.searchInput}' apps found...`
                        : 'Scanning for apps to intercept...'
                    }
                    targets={targets.map(target => {
                            const { id, name } = target;
                            const activating = this.inProgressTargetIds.includes(id);

                            return {
                                id,
                                title: `${this.deviceClassName} app: ${name} (${id})`,
                                status: activating
                                        ? 'activating'
                                        : 'available',
                                content: name
                            };
                        })
                    }
                    interceptTarget={this.interceptTarget}
                    ellipseDirection='right'
                />
            </ConfigContainer>;
        }

        return <ConfigContainer>
            <FridaTargetList
                spinnerText={`Waiting for ${this.deviceClassName} devices to attach to...`}
                targets={Object.values(this.fridaHosts).map(host => {
                    const { id, name, state } = host;
                    const activating = this.hostProgress[id] !== undefined;

                    return {
                        id,
                        title: `${this.deviceClassName} device ${name} (${id}): ${_.startCase(state)}`,
                        icon: id.includes("emulator-")
                                ? <Icon icon={['far', 'window-maximize']} />
                            : id.match(/\d+\.\d+\.\d+\.\d+:\d+/)
                                ? <Icon icon={['fas', 'network-wired']} />
                            : <Icon icon={['fas', 'mobile-alt']} />,
                        status: activating
                                ? 'activating'
                            : state === 'unavailable'
                                ? 'unavailable'
                            // Available here means clickable - interceptable/setupable/launchable
                                : 'available',
                        progress: this.hostProgress[id],
                        content: <div>
                            <HostName>{ name }</HostName>
                            <StateDescription type={host.type} state={host.state} />
                        </div>
                    };
                })}
                interceptTarget={this.selectHost}
                ellipseDirection='right'
            />
        </ConfigContainer>;
    }

}

export const FridaCustomUi = {
    columnWidth: 1,
    rowHeight: 2,
    configComponent: FridaConfig
};