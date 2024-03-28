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
import { getObservableDeferred, lazyObservablePromise } from '../../util/observable';
import { persist, hydrate } from '../../util/mobx-persist/persist';
import { ErrorLike, UnreachableCheck } from '../../util/error';
import { rawHeadersToHeaders } from '../../util/headers';
import { trackEvent } from '../../metrics';

import { EventsStore } from '../events/events-store';
import { RulesStore } from '../rules/rules-store';
import { AccountStore } from '../account/account-store';
import * as ServerApi from '../../services/server-api';

import { HttpExchange } from '../http/exchange';
import { ResponseHeadEvent, ResponseStreamEvent } from './send-response-model';
import {
    buildRequestInputFromExchange,
    ClientProxyConfig,
    RequestInput,
    SendRequest,
    RULE_PARAM_REF_KEY,
    sendRequestSchema
} from './send-request-model';

export class SendStore {

    constructor(
        private accountStore: AccountStore,
        private eventStore: EventsStore,
        private rulesStore: RulesStore
    ) {}

    readonly initialized = lazyObservablePromise(async () => {
        await Promise.all([
            this.accountStore.initialized,
            this.eventStore.initialized,
            this.rulesStore.initialized
        ]);

        if (this.accountStore.mightBePaidUser) {
            // For Pro users only, your 'Send' content persists on reload
            await hydrate({
                key: 'send-store',
                store: this
            });
        }

        if (this.sendRequests.length === 0) this.addRequestInput();
        this.selectedRequest = this.sendRequests[this.sendRequests.length - 1];

        console.log('Send store initialized');
    });

    @persist('list', sendRequestSchema) @observable
    sendRequests: Array<SendRequest> = [];

    @observable
    selectedRequest!: SendRequest;

    @action.bound
    addRequestInput(requestInput = new RequestInput()): RequestInput {
        const newSendRequest = observable({
            id: uuid(),
            request: requestInput,
            sentExchange: undefined
        });

        this.sendRequests.push(newSendRequest);
        this.selectedRequest = newSendRequest;

        return requestInput;
    }

    async addRequestInputFromExchange(exchange: HttpExchange) {
        trackEvent({ category: 'Send', action: 'Resend exchange' });

        this.addRequestInput(
            await buildRequestInputFromExchange(exchange)
        );
    }

    @action.bound
    selectRequest(sendRequest: SendRequest) {
        this.selectedRequest = sendRequest;
    }

    @action.bound
    moveSelection(distance: number) {
        const currentIndex = this.sendRequests.indexOf(this.selectedRequest);
        if (currentIndex === -1) throw new Error("Selected request is somehow not in Send requests list");

        const newIndex = _.clamp(currentIndex + distance, 0, this.sendRequests.length - 1);
        this.selectRequest(this.sendRequests[newIndex]);
    }

    @action.bound
    deleteRequest(sendRequest: SendRequest) {
        const index = this.sendRequests.indexOf(sendRequest);
        if (index === -1) throw new Error('Attempt to delete non-existent Send request');

        if (this.sendRequests.length === 1) {
            // Special case: if you close the only tab, you get a new empty tab
            this.addRequestInput(); // Add new fresh tab
            this.sendRequests.shift(); // Drop existing tab
            return;
        }

        // Otherwise >1 tab: drop the closed tab and select an appropriate replacement
        if (this.selectedRequest == sendRequest) {
            const indexToSelect = (this.sendRequests.length > index + 1)
                ? index + 1
                : index - 1;

            this.selectRequest(this.sendRequests[indexToSelect]);
        }

        this.sendRequests.splice(index, 1);
    }

    readonly sendRequest = async (sendRequest: SendRequest) => {
        trackEvent({ category: 'Send', action: 'Sent request' });

        const requestInput = sendRequest.request;
        const pendingRequestDeferred = getObservableDeferred();
        const abortController = new AbortController();
        runInAction(() => {
            sendRequest.sentExchange = undefined;

            sendRequest.pendingSend = {
                promise: pendingRequestDeferred.promise,
                abort: () => abortController.abort()
            };

            const clearPending = action(() => { sendRequest.pendingSend = undefined; });
            sendRequest.pendingSend.promise.then(clearPending, clearPending);
        });

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

        const responseStream = await ServerApi.sendRequest(
            {
                url: requestInput.url,
                method: requestInput.method,
                headers: requestInput.headers,
                rawBody: encodedBody
            },
            requestOptions,
            abortController.signal
        );

        const exchange = this.eventStore.recordSentRequest({
            id: exchangeId,
            matchedRuleId: false,
            method: requestInput.method,
            url: requestInput.url,
            protocol: url.protocol.slice(0, -1),
            path: url.pathname,
            hostname: url.hostname,
            headers: rawHeadersToHeaders(requestInput.headers),
            rawHeaders: _.cloneDeep(requestInput.headers),
            body: { buffer: encodedBody },
            timingEvents: {
                startTime: Date.now()
            } as TimingEvents,
            tags: ['httptoolkit:manually-sent-request']
        });

        // Keep the exchange up to date as response data arrives:
        trackResponseEvents(responseStream, exchange)
        .catch(action((error: ErrorLike & { timingEvents?: TimingEvents }) => {
            if (error.name === 'AbortError' && abortController.signal.aborted) {
                const startTime = exchange.timingEvents.startTime!; // Always set in Send case (just above)
                // Make a guess at an aborted timestamp, since this error won't give us one automatically:
                const durationBeforeAbort = Date.now() - startTime;
                const startTimestamp = exchange.timingEvents.startTimestamp ?? startTime;
                const abortedTimestamp = startTimestamp + durationBeforeAbort;

                exchange.markAborted({
                    id: exchange.id,
                    error: {
                        message: 'Request cancelled'
                    },
                    timingEvents: {
                        startTimestamp,
                        abortedTimestamp,
                        ...exchange.timingEvents,
                        ...error.timingEvents
                    } as TimingEvents,
                    tags: ['client-error:ECONNABORTED']
                });
            } else {
                exchange.markAborted({
                    id: exchange.id,
                    error: error,
                    timingEvents: {
                        ...exchange.timingEvents as TimingEvents,
                        ...error.timingEvents
                    },
                    tags: error.code ? [`passthrough-error:${error.code}`] : []
                });
            }
        }))
        .then(() => pendingRequestDeferred.resolve());

        runInAction(() => {
            sendRequest.sentExchange = exchange;
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