import * as _ from 'lodash';
import { action, autorun, flow, observable, runInAction } from 'mobx';
import * as uuid from 'uuid/v4';
import {
    MOCKTTP_PARAM_REF,
    ProxySetting,
    ProxySettingSource,
    RuleParameterReference,
    TimingEvents
} from 'mockttp';

import { logError } from '../../errors';
import { lazyObservablePromise } from '../../util/observable';
import { persist, hydrate } from '../../util/mobx-persist/persist';
import { ErrorLike, UnreachableCheck } from '../../util/error';
import { rawHeadersToHeaders } from '../../util/headers';

import { EventsStore } from '../events/events-store';
import { RulesStore } from '../rules/rules-store';
import * as ServerApi from '../../services/server-api';

import { HttpExchange } from '../http/exchange';
import { ResponseHeadEvent, ResponseStreamEvent } from './send-response-model';
import {
    ClientProxyConfig,
    RequestInput,
    requestInputSchema,
    RULE_PARAM_REF_KEY
} from './send-request-model';

export class SendStore {

    constructor(
        private eventStore: EventsStore,
        private rulesStore: RulesStore
    ) {}

    readonly initialized = lazyObservablePromise(async () => {
        await Promise.all([
            this.eventStore.initialized,
            this.rulesStore.initialized
        ]);

        await hydrate({
            key: 'send-store',
            store: this
        });

        autorun(() => {
            if (this.requestInputs.length === 0) this.addRequestInput();
        })

        console.log('Send store initialized');
    });

    @persist('list', requestInputSchema) @observable
    requestInputs: RequestInput[] = [];

    @action.bound
    addRequestInput(requestInput = new RequestInput()): RequestInput {
        this.requestInputs[0] = requestInput;
        return requestInput;
    }

    @observable
    sentExchange: HttpExchange | undefined;

    readonly sendRequest = async (requestInput: RequestInput) => {
        const exchangeId = uuid();

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

        const encodedBody = await requestInput.rawBody.encodingBestEffortPromise;

        const responseStream = await ServerApi.sendRequest({
            url: requestInput.url,
            method: requestInput.method,
            headers: requestInput.headers,
            rawBody: encodedBody
        }, requestOptions);

        const exchange = this.eventStore.recordSentRequest({
            id: exchangeId,
            matchedRuleId: false,
            method: requestInput.method,
            url: requestInput.url,
            protocol: url.protocol.slice(0, -1),
            path: url.pathname,
            hostname: url.hostname,
            headers: rawHeadersToHeaders(requestInput.headers),
            rawHeaders: requestInput.headers,
            body: { buffer: encodedBody },
            timingEvents: {
                startTime: Date.now()
            } as TimingEvents,
            tags: ['httptoolkit:manually-sent-request']
        });

        // Keep the exchange up to date as response data arrives:
        trackResponseEvents(responseStream, exchange)
        .catch(action((error: ErrorLike & { timingEvents?: TimingEvents }) => {
            exchange.markAborted({
                id: exchange.id,
                error: error,
                timingEvents: {
                    ...exchange.timingEvents as TimingEvents,
                    ...error.timingEvents
                },
                tags: error.code ? [`passthrough-error:${error.code}`] : []
            });
        }));

        runInAction(() => {
            this.sentExchange = exchange;
        });
    }

}

const trackResponseEvents = flow(function * (
    responseStream: ReadableStream<ResponseStreamEvent>,
    exchange: HttpExchange
) {
    const reader = responseStream.getReader();

    const timingEvents = { ...exchange.timingEvents } as TimingEvents;

    let responseHead: ResponseHeadEvent | undefined;
    let responseBodyParts: Buffer[] = [];

    while (true) {
        const { done, value } = (
            yield reader.read()
        ) as ReadableStreamReadResult<ResponseStreamEvent>;
        if (done) return;

        const messageType = value.type;
        switch (messageType) {
            case 'request-start':
                timingEvents.startTimestamp = value.timestamp;
                timingEvents.bodyReceivedTimestamp = value.timestamp;
                break;
            case 'response-head':
                responseHead = value;
                timingEvents.headersSentTimestamp = value.timestamp;
                break;
            case 'response-body-part':
                responseBodyParts.push(value.rawBody);
                break;
            case 'response-end':
                if (!responseHead) throw new Error(`Received response-end before response-head!`);

                timingEvents.responseSentTimestamp = value.timestamp;

                exchange.setResponse({
                    id: exchange.id,
                    statusCode: responseHead.statusCode,
                    statusMessage: responseHead.statusMessage ?? '',
                    headers: rawHeadersToHeaders(responseHead.headers),
                    rawHeaders: responseHead.headers,
                    body: { buffer: Buffer.concat(responseBodyParts) },
                    tags: [],
                    timingEvents
                });

                break;
            case 'error':
                if (value.error.message) {
                    timingEvents.startTimestamp ??= value.timestamp; // If request not yet started
                    timingEvents.abortedTimestamp = value.timestamp;

                    throw Object.assign(
                        new Error(value.error.message + (
                            value.error.code ? ` (${value.error.code})` : ''
                        )), {
                            code: value.error.code,
                            timingEvents
                        }
                    );
                } else {
                    logError(`Unknown response error for sent request: ${
                        JSON.stringify(value.error)
                    }`);
                    throw new Error('Unknown response error');
                }
            default:
                throw new UnreachableCheck(messageType);
        }
    }
});

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