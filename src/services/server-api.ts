import { NetworkInterfaceInfo } from 'os';
import * as _ from 'lodash';
import * as getGraphQL from 'graphql.js';
import * as semver from 'semver';

import { getDeferred } from '../util';
import { serverVersion, DETAILED_CONFIG_RANGE } from './service-versions';

const urlParams = new URLSearchParams(window.location.search);
const authToken = urlParams.get('authToken');

const graphql = getGraphQL('http://127.0.0.1:45457/', {
    // The server *might* require a token for API auth. If so, we'll be given it
    // in the query string, and we'll pass it with all requests.
    headers: authToken
        ? { 'Authorization': `Bearer ${authToken}` }
        : { },
    asJSON: true
});

export interface ServerInterceptor {
    id: string;
    version: string;
    isActivable: boolean;
    isActive: boolean;
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

export async function getConfig(): Promise<{
    certificatePath: string;
    certificateContent?: string;
    certificateFingerprint?: string;
    networkInterfaces?: { [index: string]: NetworkInterfaceInfo[] };
}> {
    const response = await graphql(`
        query getConfig {

            ${semver.satisfies(await serverVersion, DETAILED_CONFIG_RANGE)
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
        return response.config;
    }
}

export async function getInterceptors(proxyPort: number): Promise<ServerInterceptor[]> {
    const response = await graphql(`
        query getInterceptors($proxyPort: Int!) {
            interceptors {
                id
                version
                isActive(proxyPort: $proxyPort)
                isActivable
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
        console.log('Activation result', result);
        throw new Error('Failed to activate interceptor');
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
