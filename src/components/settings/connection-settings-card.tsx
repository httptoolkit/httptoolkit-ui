import * as _ from 'lodash';
import * as React from 'react';
import { observable, action, computed, flow } from 'mobx';
import { observer, inject } from "mobx-react";
import { get } from 'typesafe-get';

import { styled, css, warningColor } from '../../styles';
import { WarningIcon, Icon } from '../../icons';

import { RulesStore } from '../../model/rules/rules-store';
import { ValidationResult } from '../../model/crypto';
import { validatePKCS } from '../../services/ui-worker-api';
import {
    serverVersion,
    versionSatisfies,
    CLIENT_CERT_SERVER_RANGE,
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

const CertificateWhitelistList = styled.div`
    display: grid;
    grid-template-columns: auto min-content;
    grid-gap: 10px;
    margin: 10px 0;

    align-items: baseline;

    input {
        align-self: stretch;
        padding: 5px 10px;
        border-radius: 4px;
        border: solid 1px ${p => p.theme.containerBorder};
    }

    input[type=text] {
        font-size: ${p => p.theme.textInputFontSize};
    }
`;

const CertificateHost = styled.div`
    min-width: 300px;
    font-family: ${p => p.theme.monoFontFamily};

    ${(p: { active: boolean }) => !p.active && css`
        font-style: italic;
        opacity: 0.6;
    `}
`;

const ClientCertContentLabel = styled(ContentLabel)`
    margin-top: 40px;
`;

const ClientCertificatesList = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr min-content;
    grid-gap: 10px;
    margin: 10px 0;

    align-items: baseline;

    input[type=text] {
        font-size: ${p => p.theme.textInputFontSize};
        align-self: stretch;
        padding: 5px 10px;
        border-radius: 4px;
        border: solid 1px ${p => p.theme.containerBorder};
    }

    input[type=file] {
        display: none;
    }
`;

const CertificateFilename = styled.div`
    font-style: italic;
`;

const DecryptionInput = styled.div`
    display: flex;
    flex-direction: row;
    align-items: baseline;

    > :first-child {
        flex: 1 1;
    }

    > button {
        margin-left: 10px;
    }

    > svg {
        flex: 1 1 100%;
        text-align: center;
    }
`;

const DecryptionSpinner = styled(Icon).attrs(() => ({
    icon: ['fas', 'spinner'],
    spin: true
}))`
    margin: 0 auto;
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

const isValidHost = (host: string): boolean => !!host.match(/^[A-Za-z0-9\-.]+(:\d+)?$/);

@inject('rulesStore')
@observer
export class ConnectionSettingsCard extends React.Component<
    Omit<CollapsibleCardProps, 'children'> & {
        rulesStore?: RulesStore
    }
> {

    @observable
    whitelistHostInput = '';

    @action.bound
    unwhitelistHost(host: string) {
        const { draftWhitelistedCertificateHosts } = this.props.rulesStore!;
        const hostIndex = draftWhitelistedCertificateHosts.indexOf(host);
        if (hostIndex > -1) {
            draftWhitelistedCertificateHosts.splice(hostIndex, 1);
        }
    }

    @action.bound
    addHostToWhitelist() {
        this.props.rulesStore!.draftWhitelistedCertificateHosts.push(this.whitelistHostInput);
        this.whitelistHostInput = '';
    }

    validateHost(input: HTMLInputElement) {
        const host = input.value;
        if (!host || isValidHost(host)) {
            input.setCustomValidity('');
        } else {
            input.setCustomValidity(
                "Should be a plain hostname, optionally with a specific port"
            );
        }
        input.reportValidity();
    }

    @observable
    clientCertHostInput = '';

    readonly certFileInputRef = React.createRef<HTMLInputElement>();

    @action.bound
    removeClientCertificate(host: string) {
        const { draftClientCertificateHostMap: draftClientCertificatesHostMap } = this.props.rulesStore!;
        delete draftClientCertificatesHostMap[host];
    }

    @action.bound
    addClientCertificate() {
        const { draftClientCertificateHostMap: draftClientCertificatesHostMap } = this.props.rulesStore!;
        draftClientCertificatesHostMap[this.clientCertHostInput] = this.clientCertData!;

        this.clientCertHostInput = '';
        this.clientCertData = undefined;
        this.clientCertState = undefined;
    }

    @observable
    clientCertData: undefined | { pfx: ArrayBuffer, filename: string, passphrase?: string };

    @observable
    clientCertState: undefined | 'encrypted' | 'processing' | 'error' | 'decrypted';

    @action.bound
    onClientCertSelected(event: React.ChangeEvent<HTMLInputElement>) {
        const input = event.target;
        if (!input.files || !input.files.length) return;

        const file = input.files[0];
        const fileReader = new FileReader();
        fileReader.readAsArrayBuffer(file);

        this.clientCertState = 'processing';

        const thisCard = this; // fileReader events set 'this'
        fileReader.addEventListener('load', flow(function * () {
            thisCard.clientCertData = {
                pfx: fileReader.result as ArrayBuffer,
                filename: file.name
            };

            let result: ValidationResult;

            result = yield validatePKCS(thisCard.clientCertData.pfx, undefined);

            if (result === 'valid') {
                thisCard.clientCertState = 'decrypted';
                thisCard.clientCertData.passphrase = undefined;
                return;
            }

            if (result === 'invalid-format') {
                thisCard.clientCertState = 'error';
                return;
            }

            // If it fails, try again with an empty key, since that is sometimes used for 'no passphrase'
            result = yield validatePKCS(thisCard.clientCertData.pfx, '');

            if (result === 'valid') {
                thisCard.clientCertState = 'decrypted';
                thisCard.clientCertData.passphrase = '';
                return;
            }

            // If that still hasn't worked, it's encrypted. Mark is as such, and wait for the user
            // to either cancel, or enter the correct passphrase.
            thisCard.clientCertState = 'encrypted';
        }));

        fileReader.addEventListener('error', () => {
            thisCard.clientCertState = 'error';
        });
    }

    readonly decryptClientCertData = flow(function * (this: ConnectionSettingsCard) {
        const { pfx, passphrase } = this.clientCertData!;

        let result: ValidationResult;

        this.clientCertState = 'processing';
        result = yield validatePKCS(pfx, passphrase);
        this.clientCertState = result === 'valid'
            ? 'decrypted'
            : 'encrypted';
    });

    @action.bound
    dropClientCertData() {
        this.clientCertData = undefined;
        this.clientCertState = undefined;
    }

    render() {
        const { rulesStore, ...cardProps } = this.props;
        const {
            draftWhitelistedCertificateHosts,
            areWhitelistedCertificatesUpToDate,
            isWhitelistedCertificateSaved,
            draftClientCertificateHostMap,
            areClientCertificatesUpToDate,
            isClientCertificateUpToDate
        } = rulesStore!;

        return <CollapsibleCard {...cardProps}>
            <header>
                <CollapsibleCardHeading onCollapseToggled={
                    cardProps.onCollapseToggled
                }>
                    Connection settings
                </CollapsibleCardHeading>
            </header>
            <RestartApp
                visible={
                    !areWhitelistedCertificatesUpToDate() ||
                    !areClientCertificatesUpToDate()
                }
            />
            <ContentLabel>
                Host HTTPS Whitelist
            </ContentLabel>

            <CertificateWhitelistList>
                { draftWhitelistedCertificateHosts.map((host) => [
                    <CertificateHost
                        active={isWhitelistedCertificateSaved(host)}
                        key={`host-${host}`}
                    >
                        { host }
                        { !isWhitelistedCertificateSaved(host) && <UnsavedIcon /> }
                    </CertificateHost>,
                    <SettingsButton
                        key={`delete-${host}`}
                        // onClick={() => this.unwhitelistHost(host)}
                    >
                        <Icon icon={['far', 'trash-alt']} />
                    </SettingsButton>
                ]) }

                <input
                    type="text"
                    placeholder='Hostname to exclude from strict HTTPS checks'
                    value={this.whitelistHostInput}
                    onChange={action((e: React.ChangeEvent<HTMLInputElement>) => {
                        this.whitelistHostInput = e.target.value;
                        this.validateHost(e.target);
                    })}
                />
                <SettingsButton
                    disabled={
                        !this.whitelistHostInput ||
                        draftWhitelistedCertificateHosts.includes(this.whitelistHostInput)
                    }
                    onClick={this.addHostToWhitelist}
                >
                    <Icon icon={['fas', 'plus']} />
                </SettingsButton>
            </CertificateWhitelistList>
            <SettingsExplanation>
                Requests to these hosts will skip certificate validation and/or may use older TLS
                versions, back to TLSv1. These requests will be successful regardless of any
                self-signed, expired or invalid HTTPS configurations.
            </SettingsExplanation>

            {
                _.isString(serverVersion.value) &&
                versionSatisfies(serverVersion.value, CLIENT_CERT_SERVER_RANGE) && <>
                <ClientCertContentLabel>
                    Client Certificates
                </ClientCertContentLabel>
                <ClientCertificatesList>
                    { Object.entries(draftClientCertificateHostMap).map(([host, cert]) => [
                        <CertificateHost
                            active={isClientCertificateUpToDate(host)}
                            key={`host-${host}`}
                        >
                            { host }
                            { !isClientCertificateUpToDate(host) && <UnsavedIcon /> }
                        </CertificateHost>,

                        <CertificateFilename key={`filename-${host}`}>
                            { cert.filename }
                        </CertificateFilename>,

                        <SettingsButton
                            key={`delete-${host}`}
                            onClick={() => this.removeClientCertificate(host)}
                        >
                            <Icon icon={['far', 'trash-alt']} />
                        </SettingsButton>
                    ]) }

                    <input
                        type="text"
                        placeholder='Hostname where the certificate should be used'
                        value={this.clientCertHostInput}
                        onChange={action((e: React.ChangeEvent<HTMLInputElement>) => {
                            this.clientCertHostInput = e.target.value;
                            this.validateHost(e.target);
                        })}
                    />
                    { this.clientCertState === undefined
                        ? <>
                            <SettingsButton onClick={() => this.certFileInputRef.current!.click()}>
                                Load a certificate
                            </SettingsButton>
                            <input
                                ref={this.certFileInputRef}
                                type="file"
                                accept='.pfx,.p12,application/x-pkcs12'
                                onChange={this.onClientCertSelected}
                            />
                        </>
                        : this.clientCertState === 'processing'
                            ? <DecryptionSpinner />
                        : this.clientCertState === 'decrypted'
                            ? <DecryptionInput>
                                <CertificateFilename>{ this.clientCertData!.filename }</CertificateFilename>
                                <SettingsButton onClick={this.dropClientCertData}>
                                    <Icon icon={['fas', 'undo']} title='Deselect this certificate' />
                                </SettingsButton>
                            </DecryptionInput>
                        : this.clientCertState === 'encrypted'
                            ? <DecryptionInput>
                                <input
                                    type="text"
                                    placeholder={`The passphrase for ${this.clientCertData!.filename}`}
                                    value={this.clientCertData!.passphrase || ''}
                                    onChange={action((e: React.ChangeEvent<HTMLInputElement>) => {
                                        this.clientCertData!.passphrase = e.target.value;
                                    })}
                                />
                                <SettingsButton onClick={() => this.decryptClientCertData()}>
                                    <Icon icon={['fas', 'unlock']} title='Decrypt with this passphrase' />
                                </SettingsButton>
                                <SettingsButton onClick={this.dropClientCertData}>
                                    <Icon icon={['fas', 'undo']} title='Deselect this certificate' />
                                </SettingsButton>
                            </DecryptionInput>
                        : <DecryptionInput>
                            <p><WarningIcon /> Invalid certificate</p>
                            <SettingsButton onClick={this.dropClientCertData}>
                                <Icon icon={['fas', 'undo']} title='Deselect this certificate' />
                            </SettingsButton>
                        </DecryptionInput>
                    }
                    <SettingsButton
                        disabled={
                            !this.clientCertHostInput ||
                            this.clientCertState !== 'decrypted' || // Not decrypted yet, or
                            !!draftClientCertificateHostMap[this.clientCertHostInput] // Duplicate host
                        }
                        onClick={this.addClientCertificate}
                    >
                        <Icon icon={['fas', 'plus']} />
                    </SettingsButton>
                </ClientCertificatesList>
            </> }
        </CollapsibleCard>
    }
}