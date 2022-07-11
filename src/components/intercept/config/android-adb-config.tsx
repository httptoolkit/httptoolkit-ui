import * as _ from 'lodash';
import * as React from 'react';
import { computed, observable, action } from 'mobx';
import { observer, inject } from 'mobx-react';

import { styled } from '../../../styles';

import { Interceptor } from '../../../model/interception/interceptors';
import { ProxyStore } from '../../../model/proxy-store';
import { AccountStore } from '../../../model/account/account-store';
import { EventsStore } from '../../../model/events/events-store';
import { RulesStore } from '../../../model/rules/rules-store';

import { setUpAndroidCertificateRule } from './android-device-config';

import { Button } from '../../common/inputs';
import { Icon } from '../../../icons';

const ConfigContainer = styled.div`
    user-select: text;

    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: start;

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

const DeviceList = styled.ul`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    height: 100%;
`;

const AdbDevice = styled.li`
    margin: 0 -15px -15px;
    padding: 15px;
`;

const AdbDeviceButton = styled(Button)`
    font-size: ${p => p.theme.textSize};
    font-weight: bold;
    padding: 10px 24px;
    width: 100%;

    > svg {
        margin-right: 10px;
    }
`;

@inject('proxyStore')
@inject('rulesStore')
@inject('eventsStore')
@inject('accountStore')
@observer
class AndroidAdbConfig extends React.Component<{
    proxyStore?: ProxyStore,
    rulesStore?: RulesStore,
    eventsStore?: EventsStore,
    accountStore?: AccountStore,

    interceptor: Interceptor,
    activateInterceptor: (options: { deviceId: string }) => Promise<void>,
    reportStarted: () => void,
    reportSuccess: (options?: { showRequests?: boolean }) => void,
    closeSelf: () => void
}> {

    @computed private get deviceIds(): string[] {
        return this.props.interceptor.metadata?.deviceIds || [];
    }

    @observable private inProgressIds: string[] = [];

    async componentDidMount() {
        // If there's only one device, just connect immediately and silently
        if (this.deviceIds.length === 1) {
            this.interceptDevice(this.deviceIds[0]);
            this.props.closeSelf();
        }
    }

    render() {
        return <ConfigContainer>
            <p>
                There are multiple ADB devices connected.
            </p>
            <p>
                Pick which device you'd like to intercept:
            </p>

            <DeviceList>
                { this.deviceIds.map(id => {
                    const activating = this.inProgressIds.includes(id);

                    return <AdbDevice key={id}>
                        <AdbDeviceButton
                            disabled={activating}
                            onClick={activating ? _.noop : () => this.interceptDevice(id)}
                        >
                            {
                                activating
                                    ? <Icon icon={['fas', 'spinner']} spin />
                                : id.includes("emulator-")
                                    ? <Icon icon={['far', 'window-maximize']} />
                                : id.match(/\d+\.\d+\.\d+\.\d+:\d+/)
                                    ? <Icon icon={['fas', 'network-wired']} />
                                : <Icon icon={['fas', 'mobile-alt']} />
                            }
                            { id }
                        </AdbDeviceButton>
                    </AdbDevice>
                }) }
            </DeviceList>
        </ConfigContainer>;
    }

    @action.bound
    interceptDevice(deviceId: string) {
        const {
            inProgressIds,
            onSuccess,
            props: {
                proxyStore,
                rulesStore,
                eventsStore,
                reportStarted,
                activateInterceptor
            }
        } = this;

        // Ensure the config rule is in place before we start any activation. This listens for the
        // next config request, and uses that to track succesful setup (by calling onSuccess).
        setUpAndroidCertificateRule(
            proxyStore!.certContent!,
            rulesStore!,
            eventsStore!,
            onSuccess
        );

        reportStarted();
        const activationPromise = activateInterceptor({ deviceId: deviceId });

        inProgressIds.push(deviceId);

        activationPromise.finally(action(() => {
            _.pull(inProgressIds, deviceId);
        }));
    }

    onSuccess = () => {
        this.props.reportSuccess({
            showRequests: this.deviceIds.length <= 1
        });
    };

}

export const AndroidAdbCustomUi = {
    columnWidth: 1,
    rowHeight: 2,
    configComponent: AndroidAdbConfig
};