import * as _ from 'lodash';
import * as React from 'react';
import { observable, action, flow } from 'mobx';
import { observer, inject } from "mobx-react";

import { styled } from '../../styles';
import { WarningIcon, Icon } from '../../icons';
import { trackEvent } from '../../metrics';

import { uploadFile } from '../../util/ui';
import { asError, unreachableCheck } from '../../util/error';

import { UpstreamProxyType, RulesStore } from '../../model/rules/rules-store';
import { ParsedCertificate, ValidationResult } from '../../model/crypto';
import { isValidHost } from '../../model/network';
import { parseCert, validatePKCS } from '../../services/ui-worker-api';
import {
    serverVersion,
    versionSatisfies,
    CLIENT_CERT_SERVER_RANGE,
    PROXY_CONFIG_RANGE,
    CUSTOM_CA_TRUST_RANGE,
    WILDCARD_CLIENT_CERTS
} from '../../services/service-versions';

import { inputValidation } from '../component-utils';
import {
    CollapsibleCardProps,
    CollapsibleCard,
    CollapsibleCardHeading
} from '../common/card';
import { Select, TextInput } from '../common/inputs';
import {
    SettingsSubheading,
    SettingsButton,
    SettingsExplanation
} from './settings-components';
import { StringSettingsList, ConfigValueRow } from './string-settings-list';
import { PROXY_HOST_REGEXES, normalizeProxyHost } from '../../model/http/proxy';


const UpstreamProxySettings = styled.div`
    margin-top: 10px;

    display: flex;
    flex-direction: row;
    flex-wrap: wrap;

    > ${SettingsSubheading}, > ${SettingsExplanation} {
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

const isValidClientCertHost = (input: string): boolean =>
    isValidHost(input) || input === '*';

const validateHost = inputValidation(isValidHost,
    "Should be a plain hostname, optionally with a specific port"
);

const validateClientCertHost = inputValidation(isValidClientCertHost,
    "Should be a plain hostname, optionally with a specific port, or '*'"
);

const isValidProxyHost = (host: string | undefined): boolean =>
    !!host && PROXY_HOST_REGEXES.some(regex => regex.test(host));
const validateProxyHost = inputValidation(isValidProxyHost,
    "Should be a plain hostname, optionally with a specific port and/or username:password"
);

@observer
class UpstreamProxyConfig extends React.Component<{ rulesStore: RulesStore }> {

    @observable
    private proxyType: UpstreamProxyType = this.props.rulesStore.upstreamProxyType;

    @action.bound
    setProxyType(event: React.ChangeEvent<HTMLSelectElement>) {
        const value = event.currentTarget.value;
        this.proxyType = value as UpstreamProxyType;

        trackEvent({ category: "Config", action: "Set Proxy", value: this.proxyType });

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
        rulesStore.upstreamProxyHost = normalizeProxyHost(this.proxyHostInput);
    }

    @action.bound
    addNoProxyHost(hostname: string) {
        const { rulesStore } = this.props;
        rulesStore.upstreamNoProxyHosts = [...rulesStore.upstreamNoProxyHosts, hostname];
    }

    @action.bound
    removeNoProxyHost(hostname: string) {
        const { rulesStore } = this.props;
        rulesStore.upstreamNoProxyHosts = _.without(rulesStore.upstreamNoProxyHosts, hostname);
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

            setProxyType,
            setProxyHostInput,
            saveProxyHost,
            addNoProxyHost,
            removeNoProxyHost
        } = this;

        return <>
            <SettingsSubheading>Upstream Proxy</SettingsSubheading>

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
                        placeholder={`The ${proxyType} proxy host details, e.g. example.com or user:pwd@example.com:8080`}
                        value={proxyHostInput}
                        onChange={setProxyHostInput}
                    />
                    <SettingsButton
                        disabled={
                            !isValidProxyHost(proxyHostInput) ||
                            (normalizeProxyHost(proxyHostInput) === savedProxyHost && proxyType === savedProxyType)
                        }
                        onClick={saveProxyHost}
                    >
                        <Icon icon={['fas', 'save']} />
                    </SettingsButton>
                </> }
            </UpstreamProxySettings>

            { proxyType !== 'direct' && proxyType !== 'system' && <>
                <SettingsSubheading>
                    Non-proxied hosts
                </SettingsSubheading>

                <StringSettingsList
                    placeholder='A host whose traffic should not be sent via the proxy'
                    onAdd={addNoProxyHost}
                    onDelete={removeNoProxyHost}
                    values={noProxyHosts}
                    validationFn={validateHost}
                />
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

    @observable
    clientCertError: string | undefined;

    @action.bound
    onClientCertSelected(event: React.ChangeEvent<HTMLInputElement>) {
        const input = event.target;
        if (!input.files || !input.files.length) return;

        const file = input.files[0];
        const fileReader = new FileReader();
        fileReader.readAsArrayBuffer(file);

        this.clientCertState = 'processing';
        this.clientCertError = undefined;

        const thisConfig = this; // fileReader events set 'this'
        fileReader.addEventListener('load', flow(function * () {
            thisConfig.clientCertData = {
                pfx: fileReader.result as ArrayBuffer,
                filename: file.name
            };

            let result: ValidationResult;

            result = yield validatePKCS(thisConfig.clientCertData.pfx, undefined);

            if (result === 'invalid-passphrase') {
                // If it fails, try again with an empty key, since that is sometimes used for 'no passphrase'
                result = yield validatePKCS(thisConfig.clientCertData.pfx, '');

                if (result === 'valid') {
                    thisConfig.clientCertData.passphrase = '';
                }

                thisConfig.handleClientCertValidationResult(result);
            } else {
                thisConfig.handleClientCertValidationResult(result);
            }
        }));

        fileReader.addEventListener('error', () => {
            thisConfig.clientCertState = 'error';
        });
    }

    readonly decryptClientCertData = flow(function * (this: ClientCertificateConfig) {
        const { pfx, passphrase } = this.clientCertData!;

        this.clientCertState = 'processing';
        this.clientCertError = undefined;

        const result = yield validatePKCS(pfx, passphrase);
        this.handleClientCertValidationResult(result);
    });

    handleClientCertValidationResult(result: ValidationResult) {
        this.clientCertError = undefined;

        if (result === 'valid') {
            this.clientCertState = 'decrypted';
        } else if (result === 'invalid-passphrase') {
            this.clientCertState = 'encrypted';
        } else if (result === 'invalid-format') {
            this.clientCertState = 'error';
            this.clientCertError = 'Parsing failed';
        } else if (result === 'missing-key') {
            this.clientCertState = 'error';
            this.clientCertError = 'No private key found';
        } else if (result === 'missing-cert') {
            this.clientCertState = 'error';
            this.clientCertError = 'No certificate found';
        } else unreachableCheck(result);
    }

    @action.bound
    dropClientCertData() {
        this.clientCertData = undefined;
        this.clientCertState = undefined;
    }

    render() {
        const { clientCertificateHostMap } = this.props.rulesStore!;

        return <>
            <SettingsSubheading>
                Client Certificates
            </SettingsSubheading>
            <ClientCertificatesList>
                { Object.entries(clientCertificateHostMap).map(([host, cert]) => [
                    <ConfigValueRow key={`host-${host}`}>
                        { host }
                    </ConfigValueRow>,

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
                        validateClientCertHost(e.target);
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
                    : this.clientCertState === 'error'
                        ? <DecryptionInput>
                            <p><WarningIcon /> {this.clientCertError || 'Invalid certificate'}</p>
                            <SettingsButton onClick={this.dropClientCertData}>
                                <Icon icon={['fas', 'undo']} title='Deselect this certificate' />
                            </SettingsButton>
                        </DecryptionInput>
                    : unreachableCheck(this.clientCertState)
                }
                <SettingsButton
                    disabled={
                        !isValidClientCertHost(this.clientCertHostInput) ||
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
                connecting to their corresponding hostname. {
                    versionSatisfies(serverVersion.value, WILDCARD_CLIENT_CERTS)
                    ? <>Use <code>*</code> to use a certificate for all hosts.</>
                    : ''
                }
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
            const rawData: ArrayBuffer = yield uploadFile('arraybuffer', [
                '.pem',
                '.crt',
                '.cert',
                '.der',
                'application/x-pem-file',
                'application/x-x509-ca-cert'
            ]);

            const certificate: ParsedCertificate = yield parseCert(rawData);

            if (rulesStore.additionalCaCertificates.some(({ rawPEM }) => rawPEM === certificate.rawPEM)) {
                button.setCustomValidity(`This CA is already trusted.`);
                button.reportValidity();
                return;
            }

            rulesStore.additionalCaCertificates.push(certificate);
        } catch (error) {
            console.warn(error);

            const errorMessage = asError(error).message;

            button.setCustomValidity(`Could not load certificate: ${
                errorMessage
            }${
                errorMessage.endsWith('.') ? '' : '.'
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
            <SettingsSubheading>
                Trusted CA Certificates
            </SettingsSubheading>
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
    CollapsibleCardProps & {
        rulesStore?: RulesStore
    }
> {

    @action.bound
    unwhitelistHost(host: string) {
        const { whitelistedCertificateHosts } = this.props.rulesStore!;
        const hostIndex = whitelistedCertificateHosts.indexOf(host);
        if (hostIndex > -1) {
            whitelistedCertificateHosts.splice(hostIndex, 1);
        }
    }

    @action.bound
    addHostToWhitelist(hostname: string) {
        this.props.rulesStore!.whitelistedCertificateHosts.push(hostname);
        trackEvent({ category: "Config", action: "Whitelist Host" });
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

            <SettingsSubheading>
                Host HTTPS Whitelist
            </SettingsSubheading>

            <StringSettingsList
                placeholder='A host to exclude from strict HTTPS checks'
                onAdd={this.addHostToWhitelist}
                onDelete={this.unwhitelistHost}
                values={whitelistedCertificateHosts}

                validationFn={validateHost}
            />
            <SettingsExplanation>
                Requests to these hosts will skip certificate validation and accept some older
                TLS configurations. These requests will be successful regardless of any self-signed,
                expired or otherwise invalid HTTPS configurations.
            </SettingsExplanation>
        </CollapsibleCard>
    }
}