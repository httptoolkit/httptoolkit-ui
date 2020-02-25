import * as _ from 'lodash';
import * as React from 'react';
import { computed, observable, action } from 'mobx';
import { observer, inject } from 'mobx-react';

import { styled } from '../../../styles';

import { Interceptor } from '../../../model/interception/interceptors';
import { ServerStore } from '../../../model/server-store';
import { AccountStore } from '../../../model/account/account-store';
import { EventsStore } from '../../../model/http/events-store';
import { RulesStore } from '../../../model/rules/rules-store';

import { setUpAndroidCertificateRule } from './android-device-config';

import { Button } from '../../common/inputs';
import { Icon } from '../../../icons';
import { trackEvent } from '../../../tracking';

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

@inject('serverStore')
@inject('rulesStore')
@inject('eventsStore')
@inject('accountStore')
@observer
class AndroidAdbConfig extends React.Component<{
    serverStore?: ServerStore,
    rulesStore?: RulesStore,
    eventsStore?: EventsStore,
    accountStore?: AccountStore,

    interceptor: Interceptor,
    activateInterceptor: (options: { deviceId: string }) => Promise<void>,
    showRequests: () => void,
    closeSelf: () => void
}> {

    @computed private get deviceIds(): string[] {
        return this.props.interceptor.metadata.deviceIds;
    }

    @observable private inProgressIds: string[] = [];

    async componentDidMount() {
        if (!this.props.accountStore!.isPaidUser) {
            this.props.accountStore!.getPro('android-adb');
            this.props.closeSelf();
            return;
        }

        const rulesStore = this.props.rulesStore!;
        const eventsStore = this.props.eventsStore!;

        setUpAndroidCertificateRule(
            this.props.interceptor.id,
            this.props.serverStore!.certContent!,
            rulesStore,
            eventsStore,
            this.props.showRequests
        );

        // If there's only one device, just connect immediately and silently
        if (this.deviceIds.length === 1) {
            this.props.activateInterceptor({
                deviceId: this.deviceIds[0]
            });
            this.props.closeSelf();
            return;
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
        const activationPromise = this.props.activateInterceptor({
            deviceId: deviceId
        });

        this.inProgressIds.push(deviceId);

        activationPromise.finally(action(() => {
            _.pull(this.inProgressIds, deviceId);
        }));
    }

}

export const AndroidAdbCustomUi = {
    columnWidth: 1,
    rowHeight: 2,
    configComponent: AndroidAdbConfig
};