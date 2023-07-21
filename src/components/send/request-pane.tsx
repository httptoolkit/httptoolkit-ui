import * as _ from 'lodash';
import * as React from 'react';
import { action, computed } from 'mobx';
import { inject, observer } from 'mobx-react';
import {
    MOCKTTP_PARAM_REF,
    ProxySetting,
    ProxySettingSource,
    RuleParameterReference
} from 'mockttp';

import { RawHeaders } from '../../types';
import { styled } from '../../styles';
import { bufferToString, isProbablyUtf8, stringToBuffer } from '../../util';

import { sendRequest } from '../../services/server-api';
import { RulesStore } from '../../model/rules/rules-store';
import { SendStore } from '../../model/send/send-store';
import { UiStore } from '../../model/ui/ui-store';
import { ClientProxyConfig, RULE_PARAM_REF_KEY } from '../../model/send/send-data-model';

import { Button, TextInput } from '../common/inputs';
import { SendRequestHeadersCard } from './send-request-headers-card';
import { SendRequestBodyCard } from './send-request-body-card';

const RequestPaneContainer = styled.section`
    display: flex;
    flex-direction: column;
`;

const UrlInput = styled(TextInput)`
`;

export const getEffectivePort = (url: { protocol: string | null, port: string | null }) => {
    if (url.port) {
        return parseInt(url.port, 10);
    } else if (url.protocol === 'https:' || url.protocol === 'wss:') {
        return 443;
    } else {
        return 80;
    }
}

@inject('rulesStore')
@inject('sendStore')
@inject('uiStore')
@observer
export class RequestPane extends React.Component<{
    rulesStore?: RulesStore,
    sendStore?: SendStore,
    uiStore?: UiStore
}> {

    @computed
    get method() {
        return this.props.sendStore!.requestInput.method;
    }

    @computed
    get url() {
        return this.props.sendStore!.requestInput.url;
    }


    @computed
    get headers() {
        return this.props.sendStore!.requestInput.headers;
    }

    @computed
    get body() {
        return this.props.sendStore!.requestInput.rawBody;
    }

    get cardProps() {
        return this.props.uiStore!.sendCardProps;
    }

    @computed
    private get bodyTextEncoding() {
        // If we're handling text data, we want to show & edit it as UTF8.
        // If it's binary, that's a lossy operation, so we use binary (latin1) instead.
        return isProbablyUtf8(this.body)
            ? 'utf8'
            : 'binary';
    }

    render() {
        const bodyString = bufferToString(this.body, this.bodyTextEncoding);

        return <RequestPaneContainer>
            <UrlInput
                placeholder='https://example.com/hello?name=world'
                value={this.url}
                onChange={this.updateUrl}
            />
            <SendRequestHeadersCard
                {...this.cardProps.requestHeaders}
                headers={this.headers}
                updateHeaders={this.updateHeaders}
            />
            <SendRequestBodyCard
                {...this.cardProps.requestBody}
                body={bodyString}
                updateBody={this.updateBody}
            />
            <Button
                onClick={this.sendRequest}
            />
        </RequestPaneContainer>;
    }

    @action.bound
    updateUrl(changeEvent: React.ChangeEvent<HTMLInputElement>) {
        const { requestInput } = this.props.sendStore!;
        requestInput.url = changeEvent.target.value;
    }

    @action.bound
    updateHeaders(headers: RawHeaders) {
        const { requestInput } = this.props.sendStore!;
        requestInput.headers = headers;
    }

    @action.bound
    updateBody(input: string) {
        const { requestInput } = this.props.sendStore!;
        requestInput.rawBody = stringToBuffer(input, this.bodyTextEncoding);
    }

    @action.bound
    async sendRequest() {
        const rulesStore = this.props.rulesStore!;
        const passthroughOptions = rulesStore.activePassthroughOptions;

        const url = new URL(this.url);
        const effectivePort = getEffectivePort(url);
        const hostWithPort = `${url.hostname}:${effectivePort}`;
        const clientCertificate = passthroughOptions.clientCertificateHostMap?.[hostWithPort] ||
            passthroughOptions.clientCertificateHostMap?.[url.hostname!] ||
            undefined;

        const responseStream = await sendRequest({
            url: this.url,
            method: this.method,
            headers: this.headers,
            rawBody: this.body
        }, {
            ignoreHostHttpsErrors: passthroughOptions.ignoreHostHttpsErrors,
            trustAdditionalCAs: rulesStore.additionalCaCertificates.map((cert) => ({ cert: cert.rawPEM })),
            clientCertificate,
            proxyConfig: getProxyConfig(rulesStore.proxyConfig),
            lookupOptions: passthroughOptions.lookupOptions
        });

        const reader = responseStream.getReader();
        while(true) {
            const { done, value } = await reader.read();
            if (done) return;
            else console.log(value);
        }
    }

}

function getProxyConfig(proxyConfig: RulesStore['proxyConfig']): ClientProxyConfig {
    if (!proxyConfig) return undefined;

    if (_.isArray(proxyConfig)) {
        return proxyConfig.map((config) => getProxyConfig(config)) as ClientProxyConfig;
    }

    if (MOCKTTP_PARAM_REF in proxyConfig) {
        return {
            [RULE_PARAM_REF_KEY]: (proxyConfig as RuleParameterReference<ProxySettingSource>)[MOCKTTP_PARAM_REF]
        };
    }

    return proxyConfig as ProxySetting;
}