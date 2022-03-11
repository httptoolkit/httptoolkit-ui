import * as _ from 'lodash';
import * as React from 'react';
import { observable, action, flow } from 'mobx';
import { observer, inject } from "mobx-react";

import { styled } from '../../styles';
import { WarningIcon, Icon } from '../../icons';
import { trackEvent } from '../../tracking';

import { UpstreamProxyType, RulesStore } from '../../model/rules/rules-store';
import { ParsedCertificate, ValidationResult } from '../../model/crypto';
import { parseCert, validatePKCS } from '../../services/ui-worker-api';
import {
    serverVersion,
    versionSatisfies,
    CLIENT_CERT_SERVER_RANGE,
    PROXY_CONFIG_RANGE,
    CUSTOM_CA_TRUST_RANGE
} from '../../services/service-versions';

import {
    CollapsibleCardProps,
    CollapsibleCard,
    CollapsibleCardHeading
} from '../common/card';
import { ContentLabel } from '../common/text-content';
import { Select, TextInput } from '../common/inputs';
import { SettingsButton, SettingsExplanation } from './settings-components';
import { uploadFile } from '../../util/ui';

const SpacedContentLabel = styled(ContentLabel)`
    margin-top: 40px;
`;

const UpstreamProxySettings = styled.div`
    margin-top: 10px;

    display: flex;
    flex-direction: row;
    flex-wrap: wrap;

    > ${SpacedContentLabel}, > ${SettingsExplanation} {
        flex-basis: 100%;
    }

    > ${WarningIcon} {
        align-self: center;
    }

    > ${TextInput} {
        flex-grow: 1;
    }

    > ${SettingsButton} {
        margin-left: 10px;
    }
`;

const UpstreamProxyDropdown = styled(Select)`
    width: auto;
    font-size: ${p => p.theme.textSize};
    padding: 3px;

    margin-right: 10px;
`;

const HostList = styled.div`
    width: 100%;

    display: grid;
    grid-template-columns: auto min-content;
    grid-gap: 10px;
    margin: 10px 0;

    align-items: baseline;

    ${TextInput} {
        align-self: stretch;
    }
`;

const Host = styled.div`
    min-width: 300px;
    font-family: ${p => p.theme.monoFontFamily};
`;

const isValidHost = (host: string | undefined): boolean =>
    !!host?.match(/^[A-Za-z0-9\-.]+(:\d+)?$/);

function validateHost(input: HTMLInputElement) {
    const host = input.value;
    if (!host || isValidHost(host)) {
        input.setCustomValidity('');
    } else {
        input.setCustomValidity(
            "Should be a plain hostname, optionally with a specific port"
        );
    }
    input.reportValidity();
    return input.validity.valid;
}

const isValidProxyHost = (host: string | undefined): boolean =>
    !!host?.match(/^([^/@]*@)?[A-Za-z0-9\-.]+(:\d+)?$/);

function validateProxyHost(input: HTMLInputElement) {
    const host = input.value;
    if (!host || isValidProxyHost(host)) {
        input.setCustomValidity('');
    } else {
        input.setCustomValidity(
            "Should be a plain hostname, optionally with a specific port and/or username:password"
        );
    }
    input.reportValidity();
    return input.validity.valid;
}

@observer
class UpstreamProxyConfig extends React.Component<{ rulesStore: RulesStore }> {

    @observable
    private proxyType: UpstreamProxyType = this.props.rulesStore.upstreamProxyType;

    @action.bound
    setProxyType(event: React.ChangeEvent<HTMLSelectElement>) {
        const value = event.currentTarget.value;
        this.proxyType = value as UpstreamProxyType;

        trackEvent({ category: "Config", action: "Set Proxy", label: this.proxyType });

        if (value === 'direct' || value === 'system') {
            // Only update immediately when switching to a type that doesn't need a host input.
            // For other types, we update when we set a host, in setUpstreamProxyHost
            const rulesStore = this.props.rulesStore;
            rulesStore.upstreamProxyType = this.proxyType;
        }
    }

    @observable
    private proxyHostInput = this.props.rulesStore.upstreamProxyHost || '';

    @action.bound
    setProxyHostInput(event: React.ChangeEvent<HTMLInputElement>) {
        validateProxyHost(event.target);
        this.proxyHostInput = event.target.value;
    }

    @action.bound
    saveProxyHost() {
        if (this.proxyType === 'direct' || this.proxyType === 'system') {
            throw new Error(`Can't save proxy host for ${this.proxyType} proxy`);
        }

        // We update the rules store proxy type only at the point where we save the host:
        const rulesStore = this.props.rulesStore;
        rulesStore.upstreamProxyType = this.proxyType;
        rulesStore.upstreamProxyHost = this.proxyHostInput;
    }

    @observable
    private noProxyInput = "";

    @action.bound
    setNoProxyInput(event: React.ChangeEvent<HTMLInputElement>) {
        validateHost(event.target);
        this.noProxyInput = event.target.value;
    }

    @action.bound
    addNoProxyHost() {
        const { rulesStore } = this.props;
        rulesStore.upstreamNoProxyHosts = [...rulesStore.upstreamNoProxyHosts, this.noProxyInput];
        this.noProxyInput = '';
    }

    @action.bound
    removeNoProxyHost(noProxyHost: string) {
        const { rulesStore } = this.props;
        rulesStore.upstreamNoProxyHosts = _.without(rulesStore.upstreamNoProxyHosts, noProxyHost);
    }

    render() {
        const {
            effectiveSystemProxyConfig,
            upstreamProxyType: savedProxyType,
            upstreamProxyHost: savedProxyHost,
            upstreamNoProxyHosts: noProxyHosts
        } = this.props.rulesStore;

        const {
            proxyType,
            proxyHostInput,
            noProxyInput,

            setProxyType,
            setProxyHostInput,
            saveProxyHost,
            setNoProxyInput,
            addNoProxyHost,
            removeNoProxyHost
        } = this;

        return <>
            <ContentLabel>Upstream Proxy</ContentLabel>

            <UpstreamProxySettings>
                <UpstreamProxyDropdown
                    value={proxyType}
                    onChange={setProxyType}
                >
                    <option value={'system'}>Use system settings</option>
                    <option value={'direct'}>Connect directly</option>
                    <option value={'http'}>Use an HTTP proxy</option>
                    <option value={'https'}>Use an HTTPS proxy</option>
                    <option value={'socks4'}>Use a SOCKS 4 proxy</option>
                    <option value={'socks4a'}>Use a SOCKS 4a proxy</option>
                    <option value={'socks5'}>Use a SOCKS 5 proxy</option>
                    <option value={'socks5h'}>Use a SOCKS 5h proxy</option>
                </UpstreamProxyDropdown>

                { proxyType === 'system' && (
                        effectiveSystemProxyConfig === 'ignored' ||
                        effectiveSystemProxyConfig === 'unparseable'
                    ) &&
                    <WarningIcon />
                }

                { proxyType === 'system' && effectiveSystemProxyConfig &&
                    <SettingsExplanation>{
                        effectiveSystemProxyConfig === 'ignored'
                            ? <>
                                The system is configured with a localhost proxy.
                                To avoid issues with recursive proxy loops, this will be ignored
                                and requests will be sent directly. Localhost proxies must be
                                manually configured.
                            </>
                        : effectiveSystemProxyConfig === 'unparseable'
                            ? <>
                                The system proxy settings could not be
                                parsed, so requests will be sent directly.
                            </>
                        : <>
                            The configured system proxy is {
                                effectiveSystemProxyConfig.proxyUrl
                            }.
                        </>
                    }</SettingsExplanation>
                }

                { proxyType !== 'direct' && proxyType !== 'system' && <>
                    <TextInput
                        placeholder={`The ${proxyType} proxy host`}
                        value={proxyHostInput}
                        onChange={setProxyHostInput}
                    />
                    <SettingsButton
                        disabled={
                            !isValidProxyHost(proxyHostInput) ||
                            (proxyHostInput === savedProxyHost && proxyType === savedProxyType)
                        }
                        onClick={saveProxyHost}
                    >
                        <Icon icon={['fas', 'save']} />
                    </SettingsButton>
                </> }
            </UpstreamProxySettings>

            { proxyType !== 'direct' && proxyType !== 'system' && <>
                <SpacedContentLabel>
                    Non-proxied hosts
                </SpacedContentLabel>

                <HostList>
                    { noProxyHosts.map((host) => [
                        <Host key={`host-${host}`}>
                            { host }
                        </Host>,
                        <SettingsButton
                            key={`delete-${host}`}
                            onClick={() => removeNoProxyHost(host)}
                        >
                            <Icon icon={['far', 'trash-alt']} />
                        </SettingsButton>
                    ]) }

                    <TextInput
                        placeholder='A host whose traffic should not be sent via the proxy'
                        value={noProxyInput}
                        onChange={setNoProxyInput}
                    />
                    <SettingsButton
                        disabled={
                            !isValidHost(noProxyInput) ||
                            noProxyHosts.includes(noProxyInput)
                        }
                        onClick={addNoProxyHost}
                    >
                        <Icon icon={['fas', 'plus']} />
                    </SettingsButton>
                </HostList>
                <SettingsExplanation>
                    Requests to these hosts will always be sent directly, not via the configured proxy.
                </SettingsExplanation>
            </> }
        </>;
    }
};

const ClientCertificatesList = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr min-content;
    grid-gap: 10px;
    margin: 10px 0;

    align-items: baseline;

    ${TextInput} {
        align-self: stretch;
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

@observer
class ClientCertificateConfig extends React.Component<{ rulesStore: RulesStore }> {

    @observable
    clientCertHostInput = '';

    readonly certFileInputRef = React.createRef<HTMLInputElement>();

    @action.bound
    removeClientCertificate(host: string) {
        const { clientCertificateHostMap } = this.props.rulesStore!;
        delete clientCertificateHostMap[host];
    }

    @action.bound
    addClientCertificate() {
        const { clientCertificateHostMap } = this.props.rulesStore!;
        clientCertificateHostMap[this.clientCertHostInput] = this.clientCertData!;

        trackEvent({ category: "Config", action: "Add Client Cert" });

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

        const thisConfig = this; // fileReader events set 'this'
        fileReader.addEventListener('load', flow(function * () {
            thisConfig.clientCertData = {
                pfx: fileReader.result as ArrayBuffer,
                filename: file.name
            };

            let result: ValidationResult;

            result = yield validatePKCS(thisConfig.clientCertData.pfx, undefined);

            if (result === 'valid') {
                thisConfig.clientCertState = 'decrypted';
                thisConfig.clientCertData.passphrase = undefined;
                return;
            }

            if (result === 'invalid-format') {
                thisConfig.clientCertState = 'error';
                return;
            }

            // If it fails, try again with an empty key, since that is sometimes used for 'no passphrase'
            result = yield validatePKCS(thisConfig.clientCertData.pfx, '');

            if (result === 'valid') {
                thisConfig.clientCertState = 'decrypted';
                thisConfig.clientCertData.passphrase = '';
                return;
            }

            // If that still hasn't worked, it's encrypted. Mark is as such, and wait for the user
            // to either cancel, or enter the correct passphrase.
            thisConfig.clientCertState = 'encrypted';
        }));

        fileReader.addEventListener('error', () => {
            thisConfig.clientCertState = 'error';
        });
    }

    readonly decryptClientCertData = flow(function * (this: ClientCertificateConfig) {
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
        const { clientCertificateHostMap } = this.props.rulesStore!;

        return <>
            <SpacedContentLabel>
                Client Certificates
            </SpacedContentLabel>
            <ClientCertificatesList>
                { Object.entries(clientCertificateHostMap).map(([host, cert]) => [
                    <Host key={`host-${host}`}>
                        { host }
                    </Host>,

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

                <TextInput
                    placeholder='A host where the certificate should be used'
                    value={this.clientCertHostInput}
                    onChange={action((e: React.ChangeEvent<HTMLInputElement>) => {
                        this.clientCertHostInput = e.target.value;
                        validateHost(e.target);
                    })}
                />
                { this.clientCertState === undefined
                    ? <>
                        <SettingsButton onClick={() => this.certFileInputRef.current!.click()}>
                            Load a client certificate
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
                            <TextInput
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
                        !isValidHost(this.clientCertHostInput) ||
                        this.clientCertState !== 'decrypted' || // Not decrypted yet, or
                        !!clientCertificateHostMap[this.clientCertHostInput] // Duplicate host
                    }
                    onClick={this.addClientCertificate}
                >
                    <Icon icon={['fas', 'plus']} />
                </SettingsButton>
            </ClientCertificatesList>
            <SettingsExplanation>
                These certificates will be used for client TLS authentication, if requested by the server, when
                connecting to their corresponding hostname.
            </SettingsExplanation>
        </>;
    }
}

const AdditionalCertificateList = styled.div`
    display: grid;
    grid-template-columns: 1fr min-content;
    grid-gap: 10px;
    margin: 10px 0;

    align-items: baseline;

    input[type=file] {
        display: none;
    }
`;

const CertificateDescription = styled.div`
    font-style: italic;
`;

const AddCertificateButton = styled(SettingsButton)`
    grid-column: 1 / span 2;
`;

@observer
class AdditionalCAConfig extends React.Component<{ rulesStore: RulesStore }> {

    readonly certFileButtonRef = React.createRef<HTMLButtonElement>();

    addCertificate = flow(function * (this: AdditionalCAConfig) {
        const { rulesStore } = this.props;

        const button = this.certFileButtonRef.current!;

        try {
            const rawData = yield uploadFile('arraybuffer', [
                '.pem',
                '.crt',
                '.cert',
                '.der',
                'application/x-pem-file',
                'application/x-x509-ca-cert'
            ]);

            const certificate = yield parseCert(rawData);

            if (rulesStore.additionalCaCertificates.some(({ rawPEM }) => rawPEM === certificate.rawPEM)) {
                button.setCustomValidity(`This CA is already trusted.`);
                button.reportValidity();
                return;
            }

            rulesStore.additionalCaCertificates.push(certificate);
        } catch (error) {
            console.warn(error);
            button.setCustomValidity(`Could not load certificate: ${
                error.message
            }${
                error.message.endsWith('.') ? '' : '.'
            } File must be a PEM or DER-formatted CA certificate.`);
            button.reportValidity();
        }
    }.bind(this));

    @action.bound
    removeCertificate(certificate: ParsedCertificate) {
        const { rulesStore } = this.props;
        _.pull(rulesStore.additionalCaCertificates, certificate);
    }

    render() {
        const { additionalCaCertificates } = this.props.rulesStore;

        return <>
            <SpacedContentLabel>
                Trusted CA Certificates
            </SpacedContentLabel>
            <AdditionalCertificateList>
                { additionalCaCertificates.map((cert) => {
                    const { subject: { org, name }, serial } = cert;

                    return [
                        <CertificateDescription key={serial}>{
                            [
                                org && (!name || name.length <= 5)
                                    ? org
                                    : undefined,
                                name,
                                serial
                                    ? `(serial ${serial})`
                                    : undefined
                            ].filter(x => !!x).join(' ')
                        }</CertificateDescription>,

                        <SettingsButton
                            key={`delete-${serial}`}
                            onClick={() => this.removeCertificate(cert)}
                        >
                            <Icon icon={['far', 'trash-alt']} />
                        </SettingsButton>
                    ]
                }) }
                <AddCertificateButton
                    onClick={this.addCertificate}
                    type='submit' // Ensures we can show validation messages here
                    ref={this.certFileButtonRef}
                >
                    Load a CA certificate
                </AddCertificateButton>
            </AdditionalCertificateList>
            <SettingsExplanation>
                These Certificate Authority (CA) certificates will be considered as trusted certificate
                roots for all HTTPS requests, in addition to the existing set of built-in trusted CAs.
            </SettingsExplanation>
        </>;
    }

}

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
        const { whitelistedCertificateHosts } = this.props.rulesStore!;
        const hostIndex = whitelistedCertificateHosts.indexOf(host);
        if (hostIndex > -1) {
            whitelistedCertificateHosts.splice(hostIndex, 1);
        }
    }

    @action.bound
    addHostToWhitelist() {
        this.props.rulesStore!.whitelistedCertificateHosts.push(this.whitelistHostInput);
        trackEvent({ category: "Config", action: "Whitelist Host" });
        this.whitelistHostInput = '';
    }

    render() {
        const { rulesStore, ...cardProps } = this.props;
        const { whitelistedCertificateHosts } = rulesStore!;

        return <CollapsibleCard {...cardProps}>
            <header>
                <CollapsibleCardHeading onCollapseToggled={
                    cardProps.onCollapseToggled
                }>
                    Connection Settings
                </CollapsibleCardHeading>
            </header>

            {
                _.isString(serverVersion.value) &&
                versionSatisfies(serverVersion.value, PROXY_CONFIG_RANGE) &&
                    <UpstreamProxyConfig
                        rulesStore={rulesStore!}
                    />
            }

            {
                _.isString(serverVersion.value) &&
                versionSatisfies(serverVersion.value, CUSTOM_CA_TRUST_RANGE) &&
                <AdditionalCAConfig
                    rulesStore={rulesStore!}
                />
            }

            {
                _.isString(serverVersion.value) &&
                versionSatisfies(serverVersion.value, CLIENT_CERT_SERVER_RANGE) && <>
                <ClientCertificateConfig
                    rulesStore={rulesStore!}
                />
            </> }

            <SpacedContentLabel>
                Host HTTPS Whitelist
            </SpacedContentLabel>

            <HostList>
                { whitelistedCertificateHosts.map((host) => [
                    <Host key={`host-${host}`}>
                        { host }
                    </Host>,
                    <SettingsButton
                        key={`delete-${host}`}
                        onClick={() => this.unwhitelistHost(host)}
                    >
                        <Icon icon={['far', 'trash-alt']} />
                    </SettingsButton>
                ]) }

                <TextInput
                    placeholder='A host to exclude from strict HTTPS checks'
                    value={this.whitelistHostInput}
                    onChange={action((e: React.ChangeEvent<HTMLInputElement>) => {
                        this.whitelistHostInput = e.target.value;
                        validateHost(e.target);
                    })}
                />
                <SettingsButton
                    disabled={
                        !isValidHost(this.whitelistHostInput) ||
                        whitelistedCertificateHosts.includes(this.whitelistHostInput)
                    }
                    onClick={this.addHostToWhitelist}
                >
                    <Icon icon={['fas', 'plus']} />
                </SettingsButton>
            </HostList>
            <SettingsExplanation>
                Requests to these hosts will skip certificate validation and/or may use older TLS
                versions, back to TLSv1. These requests will be successful regardless of any
                self-signed, expired or invalid HTTPS configurations.
            </SettingsExplanation>
        </CollapsibleCard>
    }
}