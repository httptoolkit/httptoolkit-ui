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

function addRequestMetadata(request: CompletedRequest): HtkRequest {
    const parsedUrl = new URL(request.url, `${request.protocol}://${request.hostname}`);

    return Object.assign(request, {
        parsedUrl,
        source: parseSource(request.headers['user-agent']),
        contentType: getHTKContentType(request.headers['content-type'])
    });
}

function addResponseMetadata(response: CompletedResponse): HtkResponse {
    return Object.assign(response, {
        contentType: getHTKContentType(response.headers['content-type'])
    });
}

export class HttpExchange {

    constructor(request: CompletedRequest) {
        this.request = addRequestMetadata(request);

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

    public readonly request: HtkRequest
    public readonly id: string;

    @observable.ref
    public response: HtkResponse | 'aborted' | undefined;

    @observable
    public searchIndex: string;

    @observable
    public category: ExchangeCategory;

    markAborted() {
        this.response = 'aborted';
        this.searchIndex += '\naborted';
    }

    setResponse(response: CompletedResponse) {
        this.response = addResponseMetadata(response);
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