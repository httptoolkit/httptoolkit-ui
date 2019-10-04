import * as _ from 'lodash';
import * as React from 'react';
import { observable, action, computed } from 'mobx';
import { observer, inject } from "mobx-react";
import { get } from 'typesafe-get';

import { styled, css } from '../../styles';
import { WarningIcon, FontAwesomeIcon } from '../../icons';

import { InterceptionStore, isValidPortConfiguration } from '../../model/interception-store';
import {
    CollapsibleCardProps,
    CollapsibleCard,
    CollapsibleCardHeading
} from '../common/card';
import { ContentLabel } from '../common/text-content';
import { SettingsButton } from './settings-components';

const RestartApp = styled(SettingsButton).attrs(() => ({
    children: 'Restart app to activate',
    onClick: () => window.location.reload()
}))`
    position: absolute;
    top: 18px;
    left: 20px;
    font-weight: bold;

    ${(p: { visible: boolean }) => !p.visible && 'display: none;'}
`;

const CertificateWhitelistList = styled.div`
    display: grid;
    grid-template-columns: min-content min-content;
    grid-gap: 10px;
    margin: 10px 0;

    align-items: baseline;

    input {
        align-self: stretch;
        padding: 5px 10px;
        border-radius: 4px;
        border: solid 1px ${p => p.theme.containerBorder};
    }
`;

const WhitelistHost = styled.div`
    min-width: 300px;
    font-family: ${p => p.theme.monoFontFamily};

    ${(p: { active: boolean }) => !p.active && css`
        font-style: italic;
        opacity: 0.6;
    `}
`;

const ProxyPortsContainer = styled.div`
    display: grid;
    grid-template-columns: fit-content(45%) fit-content(45%) fit-content(10%);
    align-items: baseline;

    grid-gap: 10px;
    margin: 40px 0 10px 0;

    input {
        padding: 5px 10px;
        border-radius: 4px;
        border: solid 1px ${p => p.theme.containerBorder};

        & + ${WarningIcon} {
            visibility: hidden;
            align-self: center;
        }

        &:invalid {
            border-color: #f1971f;
            background-color: #f1971f40;
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

const SettingsExplanation = styled.p`
    font-style: italic;
`;

@inject('interceptionStore')
@observer
export class ProxySettingsCard extends React.Component<
    Omit<CollapsibleCardProps, 'children'> & {
        interceptionStore?: InterceptionStore
    }
> {

    @observable
    whitelistHostInput = '';

    @action.bound
    unwhitelistHost(host: string) {
        const { draftWhitelistedCertificateHosts } = this.props.interceptionStore!;
        const hostIndex = draftWhitelistedCertificateHosts.indexOf(host);
        if (hostIndex > -1) {
            draftWhitelistedCertificateHosts.splice(hostIndex, 1);
        }
    }

    @action.bound
    addHostToWhitelist() {
        this.props.interceptionStore!.draftWhitelistedCertificateHosts.push(this.whitelistHostInput);
        this.whitelistHostInput = '';
    }

    @observable
    minPortValue = (get(this.props.interceptionStore!.portConfig, 'startPort') || 8000).toString();

    @observable
    maxPortValue = (get(this.props.interceptionStore!.portConfig, 'endPort') || 65535).toString();

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
        const { serverPort, portConfig } = this.props.interceptionStore!;

        if (!portConfig) {
            return serverPort >= 8000;
        } else {
            return serverPort >= portConfig.startPort && serverPort <= portConfig.endPort;
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
        else this.props.interceptionStore!.setPortConfig(this.portConfig);
    }

    render() {
        const { interceptionStore, ...cardProps } = this.props;
        const {
            serverPort,
            whitelistedCertificateHosts,
            draftWhitelistedCertificateHosts
        } = interceptionStore!;

        return <CollapsibleCard {...cardProps}>
            <header>
                <CollapsibleCardHeading onCollapseToggled={
                    cardProps.onCollapseToggled
                }>
                    Proxy settings
                </CollapsibleCardHeading>
            </header>
            <RestartApp
                visible={
                    (this.isCurrentPortConfigValid && !this.isCurrentPortInRange) ||
                    !_.isEqual(whitelistedCertificateHosts, draftWhitelistedCertificateHosts)
                }
            />
            <ContentLabel>
                Host Certificate Whitelist
            </ContentLabel>
            <CertificateWhitelistList>
                { draftWhitelistedCertificateHosts.map((host) => [
                    <WhitelistHost
                        active={whitelistedCertificateHosts.includes(host)}
                        key={`host-${host}`}
                    >{ host }</WhitelistHost>,
                    <SettingsButton
                        key={`delete-${host}`}
                        onClick={() => this.unwhitelistHost(host)}
                    >
                        <FontAwesomeIcon icon={['far', 'trash-alt']} />
                    </SettingsButton>
                ]) }

                <input
                    type="text"
                    required
                    placeholder='Hostname to whitelist for certificate checks'
                    value={this.whitelistHostInput}
                    onChange={action((e: React.ChangeEvent<HTMLInputElement>) => {
                        this.whitelistHostInput = e.target.value;
                    })}
                />
                <SettingsButton
                    disabled={
                        !this.whitelistHostInput ||
                        draftWhitelistedCertificateHosts.includes(this.whitelistHostInput)
                    }
                    onClick={this.addHostToWhitelist}
                >
                    <FontAwesomeIcon icon={['fas', 'plus']} />
                </SettingsButton>
            </CertificateWhitelistList>
            <SettingsExplanation>
                All requests to these hosts will skip certificate validation, and so will
                appear successful despite self-signed, expired or invalid HTTPS certificates.
            </SettingsExplanation>

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
                    { serverPort }
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
        </CollapsibleCard>
    }
}