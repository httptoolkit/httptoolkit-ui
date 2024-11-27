import * as _ from 'lodash';
import * as React from 'react';
import { computed, observable, action, autorun } from 'mobx';
import { observer, inject, disposeOnUnmount } from 'mobx-react';

import { styled } from '../../../styles';

import { Interceptor } from '../../../model/interception/interceptors';
import { ProxyStore } from '../../../model/proxy-store';
import { AccountStore } from '../../../model/account/account-store';
import { EventsStore } from '../../../model/events/events-store';
import { RulesStore } from '../../../model/rules/rules-store';

import { setUpAndroidCertificateRule } from './android-device-config';

import { Icon } from '../../../icons';
import { InterceptionTargetList } from './intercept-target-list';

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

const AdbTargetList = styled(InterceptionTargetList)`
    max-height: 280px;
`;

const Footer = styled.p`
    font-size: 85%;
    font-style: italic;
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

        disposeOnUnmount(this, autorun(() => {
            if (this.deviceIds?.length === 0) {
                this.props.closeSelf();
            }
        }));
    }

    render() {
        return <ConfigContainer>
            { this.deviceIds.length > 1
                ? <>
                    <p>
                        There are multiple ADB devices connected. Pick which
                        device you'd like to intercept:
                    </p>
                </>
            : this.deviceIds.length === 1
            // Should only happen if a device disappears after UI opens, due to
            // componentDidMount auto-setup for the single-device case.
                ? <>
                    <p>
                        There is one ADB device connected.
                    </p>
                    <p>
                        Select the device below to begin setup:
                    </p>
                </>
            // No devices connected:
                : <>
                    <p>
                        There are no ADB devices connected.
                    </p>
                    <p>
                        Connect an Android device to ADB to begin setup.
                    </p>
                </> }

            <AdbTargetList
                spinnerText='Waiting for Android devices to intercept...'
                targets={this.deviceIds.map(id => {
                    const activating = this.inProgressIds.includes(id);

                    // Only new servers (1.17.0+) expose metadata.devices with names
                    const deviceName = this.props.interceptor.metadata?.devices?.[id].name
                        ?? id;

                    return {
                        id,
                        title: `Intercept Android device ${deviceName}${
                            id !== deviceName ? ` (ID: ${id})` : ''
                        }`,
                        status: activating
                                ? 'activating'
                                : 'available',
                        icon: id.includes("emulator-")
                            ? <Icon icon={['far', 'window-maximize']} />
                        : id.match(/\d+\.\d+\.\d+\.\d+:\d+/)
                            ? <Icon icon={['fas', 'network-wired']} />
                        : <Icon icon={['fas', 'mobile-alt']} />,
                        content: deviceName
                    };
                })}
                interceptTarget={this.interceptDevice}
                ellipseDirection='right'
            />

            <Footer>
                Take a look at <a
                    href="https://httptoolkit.com/docs/guides/android/"
                >the Android docs</a> for a detailed setup guide.
            </Footer>
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
        // next config request, and uses that to track successful setup (by calling onSuccess).
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