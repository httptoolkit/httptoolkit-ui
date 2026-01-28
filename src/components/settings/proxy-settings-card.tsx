import * as _ from 'lodash';
import * as React from 'react';
import { observable, action, computed, runInAction } from 'mobx';
import { observer, inject } from "mobx-react";

import { styled } from '../../styles';
import { isWindows } from '../../util/ui';
import { WarningIcon, Icon } from '../../icons';

import { isValidPortConfiguration, ProxyStore } from '../../model/proxy-store';
import { isValidHostnamePattern } from '../../model/network';
import {
    serverVersion,
    desktopVersion,
    versionSatisfies,
    INITIAL_HTTP2_RANGE,
    TLS_PASSTHROUGH_SUPPORTED,
    KEY_LOG_FILE_SUPPORTED,
    DESKTOP_SELECT_SAVE_FILE_SUPPORTED
} from '../../services/service-versions';
import { DesktopApi } from '../../services/desktop-api';

import { inputValidation } from '../component-utils';
import {
    CollapsibleCardProps,
    CollapsibleCard,
    CollapsibleCardHeading
} from '../common/card';
import { ContentLabel } from '../common/text-content';
import { Select, TextInput } from '../common/inputs';
import { IconButton } from '../common/icon-button';
import {
    SettingsButton,
    SettingsExplanation,
    SettingsSubheading
} from './settings-components';
import { StringSettingsList } from './string-settings-list';

const RestartApp = styled(SettingsButton).attrs(() => ({
    children: 'Restart app to activate',
    onClick: () => window.location.reload()
}))`
    position: absolute;
    top: 18px;
    left: 20px;
    font-weight: bold;

    &:not(:disabled) {
        background-color: ${p => p.theme.popColor};
    }

    ${(p: { visible: boolean }) => !p.visible && 'display: none;'}
`;

const UnsavedIcon = styled(Icon).attrs(() => ({
    icon: ['fas', 'save'],
}))`
    margin-left: 10px;
    color: ${p => p.theme.warningColor};
`;

const ProxyPortsContainer = styled.div`
    display: grid;
    grid-template-columns: fit-content(45%) fit-content(45%) fit-content(10%);
    align-items: baseline;

    grid-gap: 10px;
    margin-bottom: 10px;

    input {
        & + ${WarningIcon} {
            visibility: hidden;
            align-self: center;
        }

        &:invalid + ${WarningIcon} {
            visibility: visible;
        }
    }
`;

const ProxyPortStateExplanation = styled.p`
    margin-bottom: 10px;
`;

const Http2Select = styled(Select)`
    display: inline-block;
    margin-top: 10px;
    width: auto;
    font-size: ${p => p.theme.textSize};
    padding: 3px;
`;

const TlsKeyLogInputContainer = styled.div`
    margin: 10px 0;
    display: flex;
    flex-direction: column;
    position: relative;
`;

const TlsKeyLogButtonsContainer = styled.div`
    display: grid;
    grid-template-columns: auto min-content min-content;
    grid-gap: 10px;
    align-items: center;
    font-family: ${p => p.theme.monoFontFamily};
`;

const InputClearButton = styled(IconButton)`
    position: absolute;
    top: 1px;
    right: 2px;
`;

const hostnameValidation = inputValidation(isValidHostnamePattern, "Should be a valid hostname (with optional * wildcards)");

const isAbsoluteWindowsPath = (path: string) => /^([a-zA-Z]:[\\\/]|[\\\/])((?:[^<>:"\/\\|?*]+)[\\\/]?)*$/.test(path);
const isAbsolutePosixPath = (path: string) => /^\/(?:[^/]+\/?)*$/.test(path);

const pathValidation = inputValidation(
    isWindows ? isAbsoluteWindowsPath : isAbsolutePosixPath,
    "Should be a valid absolute file path"
);

@inject('proxyStore')
@observer
export class ProxySettingsCard extends React.Component<
    CollapsibleCardProps & {
        proxyStore?: ProxyStore
    }
> {

    @observable
    minPortValue = (this.props.proxyStore!.portConfig?.startPort || 8000).toString();

    @observable
    maxPortValue = (this.props.proxyStore!.portConfig?.endPort || 65535).toString();

    @action.bound
    onMinPortChange({ target: { value } }: React.ChangeEvent<HTMLInputElement>) {
        this.minPortValue = value;
        this.updatePortConfig();
    }

    @action.bound
    onMaxPortChange({ target: { value } }: React.ChangeEvent<HTMLInputElement>) {
        this.maxPortValue = value;
        this.updatePortConfig();
    }

    @computed
    get isCurrentPortInRange() {
        const { httpProxyPort, portConfig } = this.props.proxyStore!;

        if (!portConfig) {
            return httpProxyPort >= 8000;
        } else {
            return httpProxyPort >= portConfig.startPort && httpProxyPort <= portConfig.endPort;
        }
    }

    @computed
    get portConfig() {
        return {
            startPort: parseInt(this.minPortValue, 10),
            endPort: parseInt(this.maxPortValue, 10)
        };
    }

    @computed
    get isCurrentPortConfigValid() {
        return isValidPortConfiguration(this.portConfig);
    }

    updatePortConfig() {
        if (!this.isCurrentPortConfigValid) return;
        else this.props.proxyStore!.setPortConfig(this.portConfig);
    }

    @action.bound
    addTlsPassthroughHostname(hostname: string) {
        const { tlsPassthroughConfig } = this.props.proxyStore!;
        tlsPassthroughConfig.push({ hostname });
    }

    @action.bound
    removeTlsPassthroughHostname(hostname: string) {
        const { tlsPassthroughConfig } = this.props.proxyStore!;
        const hostnameIndex = _.findIndex(tlsPassthroughConfig, (passthroughItem) =>
            passthroughItem.hostname === hostname
        );

        if (hostnameIndex === -1) return;

        tlsPassthroughConfig.splice(hostnameIndex, 1);
    }

    @observable
    tlsKeyFileInput: string = this.props.proxyStore!.keyLogFilePath || '';

    @action.bound
    setTlsKeyFilePath({ target }: React.ChangeEvent<HTMLInputElement>) {
        this.tlsKeyFileInput = target.value;

        if (!this.tlsKeyFileInput.trim()) {
            this.props.proxyStore!.keyLogFilePath = undefined;
        } else if (pathValidation(target)) {
            this.props.proxyStore!.keyLogFilePath = this.tlsKeyFileInput.trim();
        }
    }

    @action.bound
    async setTlsKeyFilePathFromDialog() {
        const path = await DesktopApi.selectSaveFilePath!();
        if (!path) return; // Dialog cancelled, change nothing

        runInAction(() => {
            this.props.proxyStore!.keyLogFilePath = path;
        });
    }

    @action.bound
    clearTlsKeyFilePath() {
        this.tlsKeyFileInput = '';
        this.props.proxyStore!.keyLogFilePath = undefined;
    }

    render() {
        const { proxyStore, ...cardProps } = this.props;
        const {
            httpProxyPort,

            http2Enabled,
            http2CurrentlyEnabled,

            tlsPassthroughConfig,
            currentTlsPassthroughConfig,

            keyLogFilePath,
            currentKeyLogFilePath
        } = proxyStore!;

        return <CollapsibleCard {...cardProps}>
            <header>
                <CollapsibleCardHeading onCollapseToggled={
                    cardProps.onCollapseToggled
                }>
                    Proxy Settings
                </CollapsibleCardHeading>
            </header>
            <RestartApp
                visible={
                    (this.isCurrentPortConfigValid && !this.isCurrentPortInRange) ||
                    http2Enabled !== http2CurrentlyEnabled ||
                    !_.isEqual(tlsPassthroughConfig, currentTlsPassthroughConfig) ||
                    keyLogFilePath !== currentKeyLogFilePath
                }
            />

            <ProxyPortsContainer>
                <ContentLabel>
                    Minimum port
                </ContentLabel>
                <TextInput
                    type="number"
                    required
                    min="1"
                    max="65535"
                    value={this.minPortValue}
                    onChange={this.onMinPortChange}
                />
                <WarningIcon />

                <ContentLabel>
                    Maximum port
                </ContentLabel>
                <TextInput
                    type="number"
                    required
                    min={this.minPortValue}
                    max="65535"
                    value={this.maxPortValue}
                    onChange={this.onMaxPortChange}
                />
                <WarningIcon />
            </ProxyPortsContainer>
            <ProxyPortStateExplanation>
                The proxy is currently using port <strong>
                    { httpProxyPort }
                </strong>{
                    (this.isCurrentPortConfigValid && !this.isCurrentPortInRange)
                    ? ', outside this range. Restart the app now to use this configuration.'
                    : '.'
                }
            </ProxyPortStateExplanation>
            <SettingsExplanation>
                When opening HTTP Toolkit, it will start the proxy on the first port in
                this range that is available. If all ports in the range are in use, the
                first free port above 8000 will be used instead.
            </SettingsExplanation>

            {
                versionSatisfies(serverVersion.value, TLS_PASSTHROUGH_SUPPORTED) && <>
                    <SettingsSubheading>
                        TLS Passthrough { !_.isEqual(tlsPassthroughConfig, currentTlsPassthroughConfig) &&
                            <UnsavedIcon title="Restart app to apply changes" />
                        }
                    </SettingsSubheading>

                    <StringSettingsList
                        values={tlsPassthroughConfig.map(c => c.hostname)}
                        onAdd={this.addTlsPassthroughHostname}
                        onDelete={this.removeTlsPassthroughHostname}
                        placeholder='A hostname whose TLS connections should not be intercepted'
                        validationFn={hostnameValidation}
                    />

                    <SettingsExplanation>
                        Incoming TLS connections to these hostnames will bypass HTTP Toolkit, and will
                        be forwarded upstream untouched instead of being intercepted. Clients will not see
                        HTTP Toolkit's certificate, which may solve some connection issues, but traffic
                        within these TLS connections will not be accessible.
                    </SettingsExplanation>
                </>
            }

            {
                versionSatisfies(serverVersion.value, INITIAL_HTTP2_RANGE) && <>
                    <SettingsSubheading>
                        HTTP/2 Support { http2Enabled !== http2CurrentlyEnabled &&
                            <UnsavedIcon title="Restart app to apply changes" />
                        }
                    </SettingsSubheading>

                    <Http2Select
                        value={JSON.stringify(http2Enabled)}
                        onChange={action((event: React.ChangeEvent<HTMLSelectElement>) => {
                            const value = event.currentTarget.value;
                            if (value) {
                                proxyStore!.http2Enabled = JSON.parse(value);
                            }
                        })}
                    >
                        <option value={'true'}>Enabled for all clients</option>
                        <option value={'"fallback"'}>Enabled only for HTTP/2-only clients</option>
                        <option value={'false'}>Disabled for all clients</option>
                    </Http2Select>
                </>
            }

            {
                versionSatisfies(serverVersion.value, KEY_LOG_FILE_SUPPORTED) && <>
                    <SettingsSubheading>
                        TLS Key Log File { keyLogFilePath !== currentKeyLogFilePath &&
                            <UnsavedIcon title="Restart app to apply changes" />
                        }
                    </SettingsSubheading>

                    <TlsKeyLogInputContainer>
                        { versionSatisfies(desktopVersion.value, DESKTOP_SELECT_SAVE_FILE_SUPPORTED)
                            ? !keyLogFilePath
                                ? <SettingsButton
                                    onClick={this.setTlsKeyFilePathFromDialog}
                                >
                                    Select where to save the TLS keylog file
                                </SettingsButton>
                                : <TlsKeyLogButtonsContainer>
                                    { keyLogFilePath }
                                    <SettingsButton
                                        onClick={this.setTlsKeyFilePathFromDialog}
                                    >
                                        <Icon icon={['fas', 'folder-open']} />
                                    </SettingsButton>
                                    <SettingsButton
                                        onClick={this.clearTlsKeyFilePath}
                                    >
                                        <Icon icon={['far', 'trash-alt']} />
                                    </SettingsButton>
                                </TlsKeyLogButtonsContainer>
                            : <>
                                <TextInput
                                    placeholder={
                                        navigator.platform.startsWith('Win')
                                            ? 'C:\\tls-keys.log'
                                            : '/tmp/tls-keys.log'
                                    }
                                    value={this.tlsKeyFileInput}
                                    onChange={this.setTlsKeyFilePath}
                                />
                                { !!this.tlsKeyFileInput &&
                                    <InputClearButton
                                        title="Unset TLS key file"
                                        icon={['fas', 'times']}
                                        onClick={this.clearTlsKeyFilePath}
                                    />
                                }
                            </>
                        }
                    </TlsKeyLogInputContainer>

                    <SettingsExplanation>
                        If set, TLS keys for all client & server traffic will be logged to this file,
                        allowing inspection of raw TLS packet contents & details in low-level packet
                        inspection tools like Wireshark.
                    </SettingsExplanation>
                </>
            }
        </CollapsibleCard>
    }

}