import * as _ from 'lodash';

import {
    byteStreamToLines,
    emptyStream,
    parseJsonLinesStream
} from '../util/streams';

import { RawHeaders } from '../types';
import {
    ServerConfig,
    NetworkInterfaces,
    ServerInterceptor,
    ApiError
} from './server-api-types';

import {
    RequestDefinition,
    RequestOptions
} from '../model/send/send-request-model';
import {
    ResponseStreamEvent
} from '../model/send/send-response-model';

interface RestRequestOptions {
    abortSignal?: AbortSignal
}

export class RestApiClient {

    constructor(
        private authToken?: string
    ) {}

    private async apiRequest(
        method: string,
        path: string,
        query: Record<string, number | string> = {},
        body?: object,
        options?: RestRequestOptions
    ) {
        const operationName = `${method} ${path}`;

        const response = await fetch(`http://127.0.0.1:45457${path}${
            Object.keys(query).length
                ? '?' + new URLSearchParams(_.mapValues(query, (v) => v.toString())).toString()
                : ''
        }`, {
            method,
            headers: {
                ...(this.authToken ? {
                    'Authorization': `Bearer ${this.authToken}`,
                } : {}),
                'content-type': 'application/json'
            },
            body: body
                ? JSON.stringify(body)
                : undefined,
            signal: options?.abortSignal
        }).catch((e) => {
            throw new ApiError(`fetch failed with '${e.message ?? e}'`, operationName);
        });

        if (!response.ok) {
            const errorBody: {
                error?: {
                    message?: string,
                    code?: string
                }
            } | null = await response.json().catch(e => null);

            console.error(response.status, errorBody);

            throw new ApiError(
                `unexpected ${response.status} ${response.statusText} - ${
                    errorBody?.error?.code
                        ? `${errorBody?.error?.code} -`
                        : ''
                }${
                    errorBody?.error?.message ?? '[unknown]'
                }`,
                operationName,
                response.status
            );
        }

        return response;
    }

    private async apiJsonRequest<T extends {}>(
        method: string,
        path: string,
        query: Record<string, number | string> = {},
        body?: object
    ): Promise<T> {
        return await (
            await this.apiRequest(method, path, query, body)
        ).json() as T;
    }

    private async apiNdJsonRequest<T extends {}>(
        method: string,
        path: string,
        query: Record<string, number | string> = {},
        body?: object,
        options?: RestRequestOptions
    ): Promise<ReadableStream<T>> {
        const response = await this.apiRequest(method, path, query, body, options);

        if (!response.body) return emptyStream();

        return parseJsonLinesStream(
            byteStreamToLines(response.body)
        );
    }

    async getServerVersion(): Promise<string> {
        const response = await this.apiJsonRequest<{
            version: string
        }>('get', '/version');
        return response.version;
    }

    async getConfig(proxyPort: number) {
        const response = await this.apiJsonRequest<{
            config: ServerConfig
        }>('GET', '/config', { proxyPort: proxyPort });

        return response.config;
    }

    async getNetworkInterfaces() {
        const response = await this.apiJsonRequest<{
            networkInterfaces: NetworkInterfaces
        }>('GET', '/config/network-interfaces');

        return response.networkInterfaces;
    }

    async getInterceptors(proxyPort: number) {
        const response = await this.apiJsonRequest<{
            interceptors: ServerInterceptor[]
        }>('GET', '/interceptors', { proxyPort });

        return response.interceptors;
    }

    async getDetailedInterceptorMetadata<M extends unknown>(id: string): Promise<M | undefined> {
        const response = await this.apiJsonRequest<{
            interceptorMetadata: M
        }>('GET', `/interceptors/${id}/metadata`);

        return response.interceptorMetadata;
    }

    async activateInterceptor(id: string, proxyPort: number, options?: any) {
        const response = await this.apiJsonRequest<{
            result: { success: boolean, metadata: unknown }
        }>('POST', `/interceptors/${id}/activate/${proxyPort}`, {}, options);

        return response.result;
    }

    async sendRequest(
        requestDefinition: RequestDefinition,
        requestOptions: RequestOptions,
        options?: RestRequestOptions
    ) {
        const requestDefinitionData = {
            ...requestDefinition,
            rawBody: requestDefinition.rawBody?.toString('base64')
        }

        const requestOptionsData = {
            ...requestOptions,
            ...(requestOptions.clientCertificate ? {
                clientCertificate: {
                    ...requestOptions.clientCertificate,
                    pfx: requestOptions.clientCertificate.pfx.toString('base64')
                }
            } : {})
        }

        const responseDataStream = await this.apiNdJsonRequest<ResponseStreamEventData>(
            'POST', '/client/send', {},
            {
                request: requestDefinitionData,
                options: requestOptionsData
            },
            options
        );

        const dataStreamReader = responseDataStream.getReader();
        return new ReadableStream<ResponseStreamEvent>({
            async pull(controller) {
                const { done, value } = await dataStreamReader.read();
                if (done) return controller.close();

                if (value.type === 'response-body-part') {
                    controller.enqueue({
                        ...value,
                        rawBody: Buffer.from(value.rawBody, 'base64')
                    });
                } else {
                    controller.enqueue(value);
                }
            },
            cancel(reason) {
                responseDataStream.cancel(reason);
            }
        });
    }

    async triggerServerUpdate() {
        await this.apiJsonRequest<{}>('POST', '/update');
    }
}

type ResponseStreamEventData =
    | RequestStartData
    | ResponseHeadData
    | ResponseBodyPartData
    | ResponseEndData;

interface RequestStartData {
    type: 'request-start';
    startTime: number;
    timestamp: number;
}

interface ResponseHeadData {
    type: 'response-head';
    statusCode: number;
    statusMessage?: string;
    headers: RawHeaders;
    timestamp: number;
}

interface ResponseBodyPartData {
    type: 'response-body-part';
    rawBody: string; // base64
    timestamp: number;
}

interface ResponseEndData {
    type: 'response-end';
    timestamp: number;
}

