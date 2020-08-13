import { NetworkInterfaceInfo } from 'os';
import * as _ from 'lodash';
import * as getGraphQL from 'graphql.js';
import * as localForage from 'localforage';

import { RUNNING_IN_WORKER } from '../util';
import { getDeferred } from '../util/promise';
import { serverVersion, versionSatisfies, DETAILED_CONFIG_RANGE, INTERCEPTOR_METADATA } from './service-versions';

const authTokenPromise = !RUNNING_IN_WORKER
    // Main UI gets given the auth token directly in its URL:
    ? Promise.resolve(new URLSearchParams(window.location.search).get('authToken'))
    // New (March 2020) UI shares auth token with SW via IDB:
    : localForage.getItem<string>('latest-auth-token')
        .then((authToken) => {
            if (authToken) return authToken;

            // Old UI (Jan-March 2020) shares auth token via SW query param:
            const workerParams = new URLSearchParams((self as WorkerGlobalScope).location.search);
            return workerParams.get('authToken');

            // Pre-Jan 2020 UI doesn't share auth token - ok with old desktop, fails with 0.1.18+.
        });

const graphQLPromise = authTokenPromise.then((authToken) => {
    return getGraphQL('http://127.0.0.1:45457/', {
        // If we have an auth token (always happens, except for old desktop apps or
        // local dev), we send it as a bearer token with all server requests.
        headers: authToken
            ? { 'Authorization': `Bearer ${authToken}` }
            : { },
        asJSON: true
    })
});

const graphql = async (...args: any[]) => (await graphQLPromise)(...args);

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

const formatError = (opName: string) => (errors: GraphQLError[] | XMLHttpRequest) => {
    console.error(errors);

    if (_.isArray(errors)) {
        const errorCount = errors.length > 1 ? `s (${errors.length})` : '';

        throw new Error(
            `Server error${errorCount} during ${opName}: ${errors.map(e =>
                `${e.message} at ${e.path.join('.')}`
            ).join(', ')}`
        );
    } else if (errors instanceof XMLHttpRequest) {
        throw new Error(`Server XHR error during ${opName}, status ${errors.status} ${errors.statusText}`);
    } else {
        throw errors;
    }
}

const serverReady = getDeferred();
export const announceServerReady = () => serverReady.resolve();
export const waitUntilServerReady = () => serverReady.promise;

export async function getServerVersion(): Promise<string> {
    const response = await graphql(`
        query getVersion {
            version
        }
    `, {}).catch(formatError('get-server-version'));

    return response.version;
}

export type NetworkInterfaces = { [index: string]: NetworkInterfaceInfo[] };

export async function getConfig(): Promise<{
    certificatePath: string;
    certificateContent?: string;
    certificateFingerprint?: string;
    networkInterfaces: NetworkInterfaces;
}> {
    const response = await graphql(`
        query getConfig {

            ${versionSatisfies(await serverVersion, DETAILED_CONFIG_RANGE)
                ?  `
                    config {
                        certificatePath
                        certificateContent
                        certificateFingerprint
                    }
                    networkInterfaces
                `
                : `
                    config {
                        certificatePath
                    }
                `
            }
        }
    `, {}).catch(formatError('get-config'));

    if (response.networkInterfaces) {
        return {
            ...response.config,
            networkInterfaces: response.networkInterfaces
        }
    } else {
        return {
            ...response.config,
            networkInterfaces: {}
        }
    }
}

export async function getNetworkInterfaces(): Promise<NetworkInterfaces> {
    if (!versionSatisfies(await serverVersion, DETAILED_CONFIG_RANGE)) return {};

    const response = await graphql(`
        query getNetworkInterfaces {
            networkInterfaces
        }
    `, {}).catch(formatError('get-network-interfaces'));

    return response.networkInterfaces;
}

export async function getInterceptors(proxyPort: number): Promise<ServerInterceptor[]> {
    const response = await graphql(`
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
    `, { proxyPort }).catch(formatError('get-interceptors'));

    return response.interceptors;
}

export async function activateInterceptor(id: string, proxyPort: number, options?: any): Promise<unknown> {
    const result = await graphql(`
        mutation Activate($id: ID!, $proxyPort: Int!, $options: Json) {
            activateInterceptor(id: $id, proxyPort: $proxyPort, options: $options)
        }
    `, { id, proxyPort, options }).catch(formatError('activate-interceptor'));

    if (
        // Backward compat for a < v0.1.28 server that returns booleans:
        result.activateInterceptor === true ||
        // New server that return an object with a success prop:
        (result.activateInterceptor && result.activateInterceptor.success)
    ) {
        return result.activateInterceptor.metadata;
    } else {
        console.log('Activation result', JSON.stringify(result));
        throw new Error(`Failed to activate interceptor ${id}`);
    }
}

export async function deactivateInterceptor(id: string, proxyPort: number) {
    const result = await graphql(`
        mutation Deactivate($id: ID!, $proxyPort: Int!) {
            deactivateInterceptor(id: $id, proxyPort: $proxyPort)
        }
    `, { id, proxyPort }).catch(formatError('deactivate-interceptor'));

    if (!result.deactivateInterceptor) {
        throw new Error('Failed to deactivate interceptor');
    }
}

export async function triggerServerUpdate() {
    await graphql(`
        mutation TriggerUpdate {
            triggerUpdate
        }
    `, { })
    .catch(formatError('trigger-update'))
    // We ignore all errors, this trigger is just advisory
    .catch(console.log);
}
