import * as _ from 'lodash';
import { CompletedRequest, CompletedResponse } from 'mockttp';
import { observable } from 'mobx';

import { HtkRequest, HtkResponse } from "../types";

import { parseSource } from './sources';
import { getHTKContentType } from '../content-types';
import { getExchangeCategory, ExchangeCategory } from '../exchange-colors';

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
    }

}