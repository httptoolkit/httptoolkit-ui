import * as _ from 'lodash';
import { CompletedRequest, CompletedResponse } from 'mockttp';
import { observable } from 'mobx';

import { HtkRequest, HtkResponse } from "../types";
import { lazyObservablePromise } from '../util';

import { parseSource } from './sources';
import { getHTKContentType } from '../content-types';
import { getExchangeCategory, ExchangeCategory } from '../exchange-colors';

import { getMatchingAPI, ApiExchange } from './openapi/openapi';
import { ApiMetadata } from './openapi/build-api';
import { TimingEvents } from 'mockttp/dist/types';

function addRequestMetadata(request: CompletedRequest): HtkRequest {
    try {
        const parsedUrl = new URL(request.url, `${request.protocol}://${request.hostname}`);

        return Object.assign(request, {
            parsedUrl,
            source: parseSource(request.headers['user-agent']),
            contentType: getHTKContentType(request.headers['content-type']),
            cache: observable.map(new Map<string, unknown>(), { deep: false })
        });
    } catch (e) {
        console.log(`Failed to parse request for ${request.url} (${request.protocol}://${request.hostname})`);
        throw e;
    }
}

function addResponseMetadata(response: CompletedResponse): HtkResponse {
    return Object.assign(response, {
        contentType: getHTKContentType(response.headers['content-type']),
        cache: observable.map(new Map<string, unknown>(), { deep: false })
    });
}

export class HttpExchange {

    constructor(request: CompletedRequest) {
        this.request = addRequestMetadata(request);
        this.timingEvents = request.timingEvents;

        this.id = this.request.id;
        this.searchIndex = [
                this.request.parsedUrl.protocol + '//' +
                this.request.parsedUrl.hostname +
                this.request.parsedUrl.pathname +
                this.request.parsedUrl.search
        ]
        .concat(..._.map(this.request.headers, (value, key) => `${key}: ${value}`))
        .concat(this.request.method)
        .join('\n')
        .toLowerCase();

        this.category = getExchangeCategory(this);

        // Start loading the relevant Open API specs for this request, if any.
        this._apiMetadataPromise = getMatchingAPI(this.request);
    }

    // Logic elsewhere can put values into these caches to cache calculations
    // about this exchange weakly, so they GC with the exchange
    // Keys should be unique strings. TODO: It'd be nice to use symbols, but
    // we can't due to https://github.com/mobxjs/mobx/issues/1925
    public cache = observable.map(new Map<string, unknown>(), { deep: false });

    public readonly request: HtkRequest
    public readonly id: string;

    @observable
    public readonly timingEvents: TimingEvents;

    @observable.ref
    public response: HtkResponse | 'aborted' | undefined;

    @observable
    public searchIndex: string;

    @observable
    public category: ExchangeCategory;

    markAborted(request: CompletedRequest) {
        this.response = 'aborted';
        this.searchIndex += '\naborted';
        Object.assign(this.timingEvents, request.timingEvents);
    }

    setResponse(response: CompletedResponse) {
        this.response = addResponseMetadata(response);
        Object.assign(this.timingEvents, response.timingEvents);

        this.category = getExchangeCategory(this);
        this.searchIndex = [
            this.searchIndex,
            response.statusCode.toString(),
            response.statusMessage.toString(),
            ..._.map(response.headers, (value, key) => `${key}: ${value}`)
        ].join('\n').toLowerCase();

        // Wrap the API promise to also add this response data (but lazily)
        const requestApiPromise = this._apiPromise;
        this._apiPromise = lazyObservablePromise(() =>
            requestApiPromise.then((api) => {
                if (api) api.updateWithResponse(this.response!);
                return api;
            })
        );
    }

    // A convenient reference to the service-wide spec for this API - starts loading immediately
    private _apiMetadataPromise: Promise<ApiMetadata> | undefined;

    // Parsed API info for this specific request, loaded & parsed lazily, only if it's used
    @observable.ref
    private _apiPromise = lazyObservablePromise(async () => {
        const apiMetadata = await this._apiMetadataPromise;

        if (apiMetadata) {
            return new ApiExchange(apiMetadata, this);
        } else {
            return undefined;
        }
    });

    // Fixed value for the parsed API data - returns the data or undefined, observably.
    get api() {
        if (this._apiPromise.state === 'fulfilled') {
            return this._apiPromise.value as ApiExchange | undefined;
        }
    }

}