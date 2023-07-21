import * as _ from 'lodash';
import { observable } from 'mobx';
import {
    MOCKTTP_PARAM_REF,
    ProxySetting,
    ProxySettingSource,
    RuleParameterReference
} from 'mockttp';

import { lazyObservablePromise } from '../../util/observable';
import { persist, hydrate } from '../../util/mobx-persist/persist';

import { EventsStore } from '../events/events-store';
import { RulesStore } from '../rules/rules-store';
import * as ServerApi from '../../services/server-api';

import {
    ClientProxyConfig,
    RequestInput,
    requestInputSchema,
    RULE_PARAM_REF_KEY
} from './send-request-model';

export class SendStore {

    constructor(
        private rulesStore: RulesStore
    ) {}

    readonly initialized = lazyObservablePromise(async () => {
        await Promise.all([
            this.rulesStore.initialized
        ]);

        await hydrate({
            key: 'send-store',
            store: this
        });

        console.log('Send store initialized');
    });

    @persist('object', requestInputSchema) @observable
    requestInput: RequestInput = {
        url: '',
        method: 'GET',
        headers: [],
        requestContentType: 'text',
        rawBody: Buffer.from([])
    };

    readonly sendRequest = async (requestInput: RequestInput) => {
        const passthroughOptions = this.rulesStore.activePassthroughOptions;

        const url = new URL(requestInput.url);
        const effectivePort = getEffectivePort(url);
        const hostWithPort = `${url.hostname}:${effectivePort}`;
        const clientCertificate = passthroughOptions.clientCertificateHostMap?.[hostWithPort] ||
            passthroughOptions.clientCertificateHostMap?.[url.hostname!] ||
            undefined;

        const requestOptions = {
            ignoreHostHttpsErrors: passthroughOptions.ignoreHostHttpsErrors,
            trustAdditionalCAs: this.rulesStore.additionalCaCertificates.map((cert) =>
                ({ cert: cert.rawPEM })
            ),
            clientCertificate,
            proxyConfig: getProxyConfig(this.rulesStore.proxyConfig),
            lookupOptions: passthroughOptions.lookupOptions
        };

        const responseStream = await ServerApi.sendRequest({
            url: requestInput.url,
            method: requestInput.method,
            headers: requestInput.headers,
            rawBody: requestInput.rawBody
        }, requestOptions);

        const reader = responseStream.getReader();
        while(true) {
            const { done, value } = await reader.read();
            if (done) return;
            else console.log(value);
        }
    }

}

export const getEffectivePort = (url: { protocol: string | null, port: string | null }) => {
    if (url.port) {
        return parseInt(url.port, 10);
    } else if (url.protocol === 'https:' || url.protocol === 'wss:') {
        return 443;
    } else {
        return 80;
    }
}

function getProxyConfig(proxyConfig: RulesStore['proxyConfig']): ClientProxyConfig {
    if (!proxyConfig) return undefined;

    if (_.isArray(proxyConfig)) {
        return proxyConfig.map((config) => getProxyConfig(config)) as ClientProxyConfig;
    }

    if (MOCKTTP_PARAM_REF in proxyConfig) {
        const paramRef = (proxyConfig as RuleParameterReference<ProxySettingSource>)[MOCKTTP_PARAM_REF];
        return { [RULE_PARAM_REF_KEY]: paramRef };
    }

    return proxyConfig as ProxySetting;
}