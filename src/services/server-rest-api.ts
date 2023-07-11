import * as _ from 'lodash';

import {
    ServerConfig,
    NetworkInterfaces,
    ServerInterceptor,
    ApiError
} from './server-api-types';

export class RestApiClient {

    constructor(
        private authToken?: string
    ) {}

    async apiRequest<T extends {}>(
        method: string,
        path: string,
        query: Record<string, number | string> = {},
        body?: object
    ): Promise<T> {
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
            body: body ?
                JSON.stringify(body)
                : undefined
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

        return await response.json() as T;
    }

    async getServerVersion(): Promise<string> {
        const response = await this.apiRequest<{
            version: string
        }>('get', '/version');
        return response.version;
    }

    async getConfig(proxyPort: number) {
        const response = await this.apiRequest<{
            config: ServerConfig
        }>('GET', '/config', { proxyPort: proxyPort });

        return response.config;
    }

    async getNetworkInterfaces() {
        const response = await this.apiRequest<{
            networkInterfaces: NetworkInterfaces
        }>('GET', '/config/network-interfaces');

        return response.networkInterfaces;
    }

    async getInterceptors(proxyPort: number) {
        const response = await this.apiRequest<{
            interceptors: ServerInterceptor[]
        }>('GET', '/interceptors', { proxyPort });

        return response.interceptors;
    }

    async getDetailedInterceptorMetadata<M extends unknown>(id: string): Promise<M | undefined> {
        const response = await this.apiRequest<{
            interceptorMetadata: M
        }>('GET', `/interceptors/${id}/metadata`);

        return response.interceptorMetadata;
    }

    async activateInterceptor(id: string, proxyPort: number, options?: any) {
        const response = await this.apiRequest<{
            result: { success: boolean, metadata: unknown }
        }>('POST', `/interceptors/${id}/activate/${proxyPort}`, {}, options);

        return response.result;
    }

    async triggerServerUpdate() {
        await this.apiRequest<{}>('POST', '/update');
    }
}