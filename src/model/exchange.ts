import * as _ from 'lodash';
import { observable } from 'mobx';

import {
    HtkRequest,
    HtkResponse,
    Headers,
    MessageBody,
    InputRequest,
    InputResponse,
    TimingEvents,
    InputMessage
} from "../types";
import {
    lazyObservablePromise,
    ObservablePromise,
    fakeBuffer,
    FakeBuffer,
    asHeaderArray
} from '../util';

import { parseSource } from './sources';
import { getHTKContentType } from '../content-types';
import { getExchangeCategory, ExchangeCategory } from '../exchange-colors';

import { getMatchingAPI, ApiExchange } from './openapi/openapi';
import { ApiMetadata } from './openapi/build-api';
import { decodeBody } from '../workers/worker-api';

export { TimingEvents };

function addRequestMetadata(request: InputRequest): HtkRequest {
    try {
        const parsedUrl = new URL(request.url, `${request.protocol}://${request.hostname}`);

        return Object.assign(request, {
            parsedUrl,
            source: parseSource(request.headers['user-agent']),
            body: new ExchangeBody(request, request.headers),
            contentType: getHTKContentType(request.headers['content-type']),
            cache: observable.map(new Map<symbol, unknown>(), { deep: false })
        }) as HtkRequest;
    } catch (e) {
        console.log(`Failed to parse request for ${request.url} (${request.protocol}://${request.hostname})`);
        throw e;
    }
}

function addResponseMetadata(response: InputResponse): HtkResponse {
    return Object.assign(response, {
        body: new ExchangeBody(response, response.headers),
        contentType: getHTKContentType(response.headers['content-type']),
        cache: observable.map(new Map<symbol, unknown>(), { deep: false })
    }) as HtkResponse;
}

export class ExchangeBody implements MessageBody {

    constructor(
        message: InputMessage,
        headers: Headers
    ) {
        if (!message.body) {
            this._encoded = Buffer.from("");
        } else if ('buffer' in message.body) {
            this._encoded = message.body.buffer;
        } else {
            this._encoded = fakeBuffer(message.body.encodedLength);
            this._decoded = message.body.decoded;
        }

        this._contentEncoding = asHeaderArray(headers['content-encoding']);
    }

    private _contentEncoding: string[];
    private _encoded: FakeBuffer | Buffer;
    get encoded() {
        return this._encoded;
    }

    private _decoded: Buffer | undefined;

    decodedPromise: ObservablePromise<Buffer | undefined> = lazyObservablePromise(async () => {
        // Exactly one of _encoded & _decoded is a buffer, never neither/both.
        if (this._decoded) return this._decoded;
        const encodedBuffer = this.encoded as Buffer;

        // Temporarily change to a fake buffer, while the web worker takes the data to decode
        const encodedLength = encodedBuffer.byteLength;
        this._encoded = fakeBuffer(encodedLength);

        try {
            const { decoded, encoded } = await decodeBody(encodedBuffer, this._contentEncoding);
            this._encoded = encoded;
            return decoded;
        } catch {
            return undefined;
        }
    });
    get decoded() {
        // We exclude 'Error' from the value - errors should always become undefined
        return this.decodedPromise.value as Buffer | undefined;
    }
}

export class HttpExchange {

    constructor(request: InputRequest) {
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
    // about this exchange weakly, so they GC with the exchange.
    // Keyed by symbols only, so we know we never have conflicts.
    public cache = observable.map(new Map<symbol, unknown>(), { deep: false });

    public readonly request: HtkRequest
    public readonly id: string;

    @observable
    public readonly timingEvents: TimingEvents | {};  // May be {} if using an old server (<0.1.7)

    @observable.ref
    public response: HtkResponse | 'aborted' | undefined;

    @observable
    public searchIndex: string;

    @observable
    public category: ExchangeCategory;

    markAborted(request: InputRequest) {
        this.response = 'aborted';
        this.searchIndex += '\naborted';
        Object.assign(this.timingEvents, request.timingEvents);
    }

    setResponse(response: InputResponse) {
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