import * as _ from 'lodash';
import * as getGraphQL from 'graphql.js';
import { getDeferred } from '../util';

const graphql = getGraphQL('http://127.0.0.1:45457/', { asJSON: true });

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

export async function getConfig() {
    const response = await graphql(`
        query getConfig {
            config {
                certificatePath
            }
        }
    `, {}).catch(formatError('get-config'));

    return response.config;
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

export async function activateInterceptor(id: string, proxyPort: number) {
    const result = await graphql(`
        mutation Activate($id: ID!, $proxyPort: Int!) {
            activateInterceptor(id: $id, proxyPort: $proxyPort)
        }
    `, { id, proxyPort }).catch(formatError('activate-interceptor'));

    if (!result.activateInterceptor) {
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
