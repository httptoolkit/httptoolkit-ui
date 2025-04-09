import { action, observable, runInAction, when } from 'mobx';

import { logError } from '../../errors';
import { UnreachableCheck } from '../../util/error';

import { HttpExchangeView } from '../../types';

import { OpenApiExchange } from '../api/openapi';
import { parseRpcApiExchange } from '../api/jsonrpc';
import { ApiExchange, ApiMetadata } from '../api/api-interfaces';
import { ApiStore } from '../api/api-store';

export class ApiDetector {

    constructor(
        private exchange: HttpExchangeView,
        apiStore: ApiStore
    ) {
        apiStore.getApi(exchange.request)
        .then(action((apiMetadata: ApiMetadata | undefined) => {
            this.apiMetadata = apiMetadata;
        })).catch(console.warn);
    }

    @observable.ref
    apiMetadata: ApiMetadata | undefined = undefined;

    _parsedApiPromise: Promise<ApiExchange | undefined> | undefined = undefined;

    @observable.ref
    _parsedApi: ApiExchange | undefined = undefined;

    /**
     * Reading this starts API parsing, if the API data is available. If this is observed when the API metadata
     * becomes available, it will trigger parsing as a side-effect.
     */
    get parsedApi(): ApiExchange | undefined {
        if (!this.apiMetadata) return;

        if (!this._parsedApi && !this._parsedApiPromise) {
            this._parsedApiPromise = (async () => {
                // We load the spec, but we don't try to parse API requests until we've received
                // the whole thing (because e.g. JSON-RPC requests aren't parseable without the body)
                await when(() => this.exchange.isCompletedRequest());

                // API metadata must be set - we check beforehand, and it's never cleared after setting
                const apiMetadata = this.apiMetadata!;
                const request = this.exchange.request;

                try {
                    let apiExchange: ApiExchange | undefined;
                    if (apiMetadata.type === 'openapi') {
                        apiExchange = new OpenApiExchange(apiMetadata, this.exchange);
                    } else if (apiMetadata.type === 'openrpc') {
                        apiExchange = await parseRpcApiExchange(apiMetadata, this.exchange);
                    } else {
                        console.log('Unknown API metadata type for host', request.parsedUrl.hostname);
                        console.log(apiMetadata);
                        throw new UnreachableCheck(apiMetadata, m => m.type);
                    }

                    runInAction(() => {
                        this._parsedApi = apiExchange;
                    });

                    if (!this.exchange.isCompletedExchange()) {
                        when(() => this.exchange.isCompletedExchange()).then(async () => {
                            if (this.exchange.response) {
                                apiExchange!.updateWithResponse(this.exchange.response);
                            }
                        });
                    }

                    return apiExchange;
                } catch (e) {
                    logError(e);
                    throw e;
                }
            })();
        }

        return this._parsedApi;
    }

}