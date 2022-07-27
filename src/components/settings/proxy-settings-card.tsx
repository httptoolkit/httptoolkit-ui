import * as _ from 'lodash';
import * as React from 'react';
import { observable, action, computed } from 'mobx';
import { observer, inject } from "mobx-react";

import { styled, warningColor } from '../../styles';
import { WarningIcon, Icon } from '../../icons';

import { isValidPortConfiguration, ProxyStore } from '../../model/proxy-store';
import {
    serverVersion,
    versionSatisfies,
    INITIAL_HTTP2_RANGE
} from '../../services/service-versions';

import {
    CollapsibleCardProps,
    CollapsibleCard,
    CollapsibleCardHeading
} from '../common/card';
import { ContentLabel } from '../common/text-content';
import { Select } from '../common/inputs';
import { Pill } from '../common/pill';
import { SettingsButton, SettingsExplanation } from './settings-components';

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
        padding: 5px 10px;
        border-radius: 4px;
        border: solid 1px ${p => p.theme.containerBorder};

        & + ${WarningIcon} {
            visibility: hidden;
            align-self: center;
        }

        &:invalid {
            border-color: ${p => p.theme.warningColor};
            background-color: ${p => p.theme.warningBackground};
            color: ${p => p.theme.mainColor};

            & + ${WarningIcon} {
                visibility: visible;
            }
        }
    }
`;

const ProxyPortStateExplanation = styled.p`
    margin-bottom: 10px;
`;

const Http2SettingsContainer = styled.div`
    margin-top: 40px;

    ${Pill} {
        display: inline-block;
        margin-left: 5px;
    }

    ${Select} {
        display: inline-block;
        margin-top: 10px;
        width: auto;
        font-size: ${p => p.theme.textSize};
        padding: 3px;
    }
`;

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

    render() {
        const { proxyStore, ...cardProps } = this.props;
        const { httpProxyPort, http2Enabled, http2CurrentlyEnabled } = proxyStore!;

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
                    http2Enabled !== http2CurrentlyEnabled
                }
            />

            <ProxyPortsContainer>
                <ContentLabel>
                    Minimum port
                </ContentLabel>
                <input
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
                <input
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
                _.isString(serverVersion.value) &&
                versionSatisfies(serverVersion.value, INITIAL_HTTP2_RANGE) &&
                <Http2SettingsContainer>
                    <div>
                        <ContentLabel>HTTP/2 Support</ContentLabel>
                        <Pill color={warningColor}>Experimental</Pill>
                    </div>

                    <Select
                        value={JSON.stringify(http2Enabled)}
                        onChange={action((event: React.ChangeEvent<HTMLSelectElement>) => {
                            const value = event.currentTarget.value;
                            if (value) {
                                proxyStore!.http2Enabled = JSON.parse(value);
                            }
                        })}
                    >
                        <option value={'true'}>Enabled for all clients</option>
                        <option value={'"fallback"'}>Disabled, except for HTTP/2-only clients</option>
                        <option value={'false'}>Disabled for all clients</option>
                    </Select>
                    { http2Enabled !== http2CurrentlyEnabled &&
                        <UnsavedIcon />
                    }
                </Http2SettingsContainer>
            }
        </CollapsibleCard>
    }
}