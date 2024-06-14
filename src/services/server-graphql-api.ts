import * as _ from 'lodash';
import type { ProxySetting } from 'mockttp';

import {
    serverVersion,
    versionSatisfies,
    DETAILED_CONFIG_RANGE,
    INTERCEPTOR_METADATA,
    DETAILED_METADATA,
    PROXY_CONFIG_RANGE,
    DNS_AND_RULE_PARAM_CONFIG_RANGE
} from './service-versions';

import {
    ServerConfig,
    NetworkInterfaces,
    ServerInterceptor,
    ApiError
} from './server-api-types';

interface GraphQLError {
    locations: Array<{ line: number, column: number }>;
    message: string;
    path: Array<string>
}

export class GraphQLApiClient {

    constructor(
        private authToken?: string
    ) {}

    async graphql<T extends {}>(operationName: string, query: string, variables: unknown) {
        const response = await fetch('http://127.0.0.1:45457', {
            method: 'POST',
            headers: {
                ...(this.authToken ? {
                    'Authorization': `Bearer ${this.authToken}`,
                } : {}),
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                operationName,
                query,
                variables
            })
        }).catch((e) => {
            throw new ApiError(`fetch failed with '${e.message ?? e}'`, operationName);
        });

        if (!response.ok) {
            console.error(response);
            throw new ApiError(
                `unexpected status ${response.status} ${response.statusText}`,
                operationName,
                response.status
            );
        }

        const { data, errors } = await response.json() as { data: T, errors?: GraphQLError[] };

        if (errors && errors.length) {
            console.error(errors);

            const errorCount = errors.length > 1 ? `s (${errors.length})` : '';

            throw new ApiError(
                `GraphQL error${errorCount}: ${errors.map(e =>
                    `${e.message} at ${e.path.join('.')}`
                ).join(', ')}`,
                operationName
            );
        }

        return data;
    }

    async getServerVersion(): Promise<string> {
        const response = await this.graphql<{ version: string }>('getVersion', `
            query getVersion {
                version
            }
        `, {});

        return response.version;
    }

    async getConfig(proxyPort: number): Promise<ServerConfig> {
        const response = await this.graphql<{
            config: {
                certificatePath: string;
                certificateContent?: string;
                certificateFingerprint?: string;
            }
            networkInterfaces?: NetworkInterfaces;
            systemProxy?: ProxySetting;
            dnsServers?: string[];
            ruleParameterKeys?: string[];
        }>('getConfig', `
            ${versionSatisfies(await serverVersion, DNS_AND_RULE_PARAM_CONFIG_RANGE)
                ? `query getConfig($proxyPort: Int!) {`
                : 'query getConfig {'
            }
                config {
                    certificatePath
                    ${versionSatisfies(await serverVersion, DETAILED_CONFIG_RANGE)
                    ?  `
                        certificateContent
                        certificateFingerprint
                    ` : ''}
                }

                ${versionSatisfies(await serverVersion, DETAILED_CONFIG_RANGE)
                ? `networkInterfaces`
                : ''}

                ${versionSatisfies(await serverVersion, PROXY_CONFIG_RANGE)
                ? `systemProxy {
                    proxyUrl
                    noProxy
                }` : ''}

                ${versionSatisfies(await serverVersion, DNS_AND_RULE_PARAM_CONFIG_RANGE)
                ? `
                    dnsServers(proxyPort: $proxyPort)
                    ruleParameterKeys
                `
                : ''}
            }
        `, { proxyPort: proxyPort });

        return {
            ...response.config,
            networkInterfaces: response.networkInterfaces || {},
            systemProxy: response.systemProxy,
            dnsServers: response.dnsServers || [],
            ruleParameterKeys: response.ruleParameterKeys || []
        }
    }

    async getNetworkInterfaces(): Promise<NetworkInterfaces> {
        if (!versionSatisfies(await serverVersion, DETAILED_CONFIG_RANGE)) return {};

        const response = await this.graphql<{
            networkInterfaces: NetworkInterfaces
        }>('getNetworkInterfaces', `
            query getNetworkInterfaces {
                networkInterfaces
            }
        `, {});

        return response.networkInterfaces;
    }

    async getInterceptors(proxyPort: number): Promise<ServerInterceptor[]> {
        const response = await this.graphql<{
            interceptors: ServerInterceptor[]
        }>('getInterceptors', `
            query getInterceptors($proxyPort: Int!) {
                interceptors {
                    id
                    version
                    isActive(proxyPort: $proxyPort)
                    isActivable

                    ${versionSatisfies(await serverVersion, INTERCEPTOR_METADATA)
                        ? 'metadata'
                        : ''
                    }
                }
            }
        `, { proxyPort });

        return response.interceptors;
    }

    async getDetailedInterceptorMetadata<M extends unknown>(id: string, subId?: string): Promise<M | undefined> {
        if (!versionSatisfies(await serverVersion, DETAILED_METADATA)) return undefined;

        if (subId) {
            throw new Error('Metadata subqueries cannot be used with GraphQL API client');
        }

        const response = await this.graphql<{
            interceptor: { metadata: M }
        }>('getDetailedInterceptorMetadata', `
            query getDetailedInterceptorMetadata($id: ID!) {
                interceptor(id: $id) {
                    metadata(type: DETAILED)
                }
            }
        `, { id });

        return response.interceptor.metadata;
    }

    async activateInterceptor(id: string, proxyPort: number, options?: any) {
        const response = await this.graphql<{
            activateInterceptor: boolean | { success: boolean, metadata: unknown }
        }>('Activate', `
            mutation Activate($id: ID!, $proxyPort: Int!, $options: Json) {
                activateInterceptor(id: $id, proxyPort: $proxyPort, options: $options)
            }
        `, { id, proxyPort, options });

        const activationResult = response.activateInterceptor;

        if (_.isBoolean(activationResult)) {
            // Backward compat for a < v0.1.28 server that returns booleans:
            return { success: activationResult, metadata: undefined };
        } else {
            // Modern server that return an object with a success prop:
            return activationResult;
        }
    }

    async triggerServerUpdate() {
        await this.graphql<{}>('TriggerUpdate', `
            mutation TriggerUpdate {
                triggerUpdate
            }
        `, { });
    }
}