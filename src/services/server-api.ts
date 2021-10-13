import { NetworkInterfaceInfo } from 'os';
import * as _ from 'lodash';
import * as localForage from 'localforage';
import { ProxyConfig } from 'mockttp';

import { RUNNING_IN_WORKER } from '../util';
import { getDeferred } from '../util/promise';
import {
    serverVersion,
    versionSatisfies,
    DETAILED_CONFIG_RANGE,
    INTERCEPTOR_METADATA,
    DETAILED_METADATA,
    PROXY_CONFIG_RANGE,
    DNS_CONFIG_RANGE
} from './service-versions';

const authTokenPromise = !RUNNING_IN_WORKER
    // Main UI gets given the auth token directly in its URL:
    ? Promise.resolve(new URLSearchParams(window.location.search).get('authToken'))
    // For workers, the new (March 2020) UI shares the auth token with SW via IDB:
    : localForage.getItem<string>('latest-auth-token')
        .then((authToken) => {
            if (authToken) return authToken;

            // Old UI (Jan-March 2020) shares auth token via SW query param:
            const workerParams = new URLSearchParams(
                (self as unknown as WorkerGlobalScope).location.search
            );
            return workerParams.get('authToken');

            // Pre-Jan 2020 UI doesn't share auth token - ok with old desktop, fails with 0.1.18+.
        });

const authHeaders = authTokenPromise.then((authToken): Record<string, string> =>
    authToken
        ? { 'Authorization': `Bearer ${authToken}` }
        : {}
);

const graphql = async <T extends {}>(operationName: string, query: string, variables: unknown) => {
    const response = await fetch('http://127.0.0.1:45457', {
        method: 'POST',
        headers: {
            ...await authHeaders,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            operationName,
            query,
            variables
        })
    });

    if (!response.ok) {
        console.error(response);
        throw new Error(
            `Server XHR error during ${operationName}, status ${response.status} ${response.statusText}`
        );
    }

    const { data, errors } = await response.json() as { data: T, errors?: GraphQLError[] };

    if (errors && errors.length) {
        console.error(errors);

        const errorCount = errors.length > 1 ? `s (${errors.length})` : '';

        throw new Error(
            `Server error${errorCount} during ${operationName}: ${errors.map(e =>
                `${e.message} at ${e.path.join('.')}`
            ).join(', ')}`
        );
    }

    return data;
}

export interface ServerInterceptor {
    id: string;
    version: string;
    isActivable: boolean;
    isActive: boolean;
    metadata?: any;
}

interface GraphQLError {
    locations: Array<{ line: number, column: number }>;
    message: string;
    path: Array<string>
}

const serverReady = getDeferred();
export const announceServerReady = () => serverReady.resolve();
export const waitUntilServerReady = () => serverReady.promise;

export async function getServerVersion(): Promise<string> {
    const response = await graphql<{ version: string }>('getVersion', `
        query getVersion {
            version
        }
    `, {});

    return response.version;
}

export type NetworkInterfaces = { [index: string]: NetworkInterfaceInfo[] };

export async function getConfig(proxyPort: number): Promise<{
    certificatePath: string;
    certificateContent?: string;
    certificateFingerprint?: string;
    networkInterfaces: NetworkInterfaces;
    systemProxy: ProxyConfig | undefined;
    dnsServers: string[];
}> {
    const response = await graphql<{
        config: {
            certificatePath: string;
            certificateContent?: string;
            certificateFingerprint?: string;
        }
        networkInterfaces?: NetworkInterfaces;
        systemProxy?: ProxyConfig;
        dnsServers?: string[];
    }>('getConfig', `
        ${versionSatisfies(await serverVersion, DNS_CONFIG_RANGE)
            ? `query getConfig($proxyPort: Int!) {`
            : 'query getConfig {'}
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

            ${versionSatisfies(await serverVersion, DNS_CONFIG_RANGE)
            ? `dnsServers(proxyPort: $proxyPort)`
            : ''}
        }
    `, { proxyPort: proxyPort });

    return {
        ...response.config,
        networkInterfaces: response.networkInterfaces || {},
        systemProxy: response.systemProxy,
        dnsServers: response.dnsServers || []
    }
}

export async function getNetworkInterfaces(): Promise<NetworkInterfaces> {
    if (!versionSatisfies(await serverVersion, DETAILED_CONFIG_RANGE)) return {};

    const response = await graphql<{
        networkInterfaces: NetworkInterfaces
    }>('getNetworkInterfaces', `
        query getNetworkInterfaces {
            networkInterfaces
        }
    `, {});

    return response.networkInterfaces;
}

export async function getInterceptors(proxyPort: number): Promise<ServerInterceptor[]> {
    const response = await graphql<{
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

export async function getDetailedInterceptorMetadata<M extends unknown>(id: string): Promise<M | undefined> {
    if (!versionSatisfies(await serverVersion, DETAILED_METADATA)) return undefined;

    const response = await graphql<{
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

export async function activateInterceptor(id: string, proxyPort: number, options?: any): Promise<unknown> {
    const result = await graphql<{
        activateInterceptor: boolean | { success: boolean, metadata: unknown }
    }>('Activate', `
        mutation Activate($id: ID!, $proxyPort: Int!, $options: Json) {
            activateInterceptor(id: $id, proxyPort: $proxyPort, options: $options)
        }
    `, { id, proxyPort, options });

    if (result.activateInterceptor === true) {
        // Backward compat for a < v0.1.28 server that returns booleans:
        return undefined;
    } else if (result.activateInterceptor && result.activateInterceptor.success) {
        // Modern server that return an object with a success prop:
        return result.activateInterceptor.metadata;
    } else {
        // Some kind of falsey failure:
        console.log('Activation result', JSON.stringify(result));

        const error = Object.assign(
            new Error(`Failed to activate interceptor ${id}`),
            result.activateInterceptor && result.activateInterceptor.metadata
                ? { metadata: result.activateInterceptor.metadata }
                : {}
        );

        throw error;
    }
}

export async function triggerServerUpdate() {
    await graphql<{}>('TriggerUpdate', `
        mutation TriggerUpdate {
            triggerUpdate
        }
    `, { })
    // We ignore all errors, this trigger is just advisory
    .catch(console.log);
}
