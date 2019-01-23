import * as _ from 'lodash';
import * as getGraphQL from 'graphql.js';

const graphql = getGraphQL('http://localhost:45457/', { asJSON: true });

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

function formatError(errors: GraphQLError[] | XMLHttpRequest) {
    console.error(errors);

    if (_.isArray(errors)) {
        const errorCount = errors.length > 1 ? `s (${errors.length})` : '';

        throw new Error(
            `Server error${errorCount}: ${errors.map(e =>
                `${e.message} at ${e.path.join('.')}`
            ).join(', ')}`
        );
    } else if (errors instanceof XMLHttpRequest) {
        throw new Error(`Server XHR error, status ${errors.status} ${errors.statusText}`);
    } else {
        throw errors;
    }
}

export async function getVersion(): Promise<string> {
    const response = await graphql(`
        query getVersion {
            version
        }
    `, {}).catch(formatError);

    return response.version;
}

export async function getConfig() {
    const response = await graphql(`
        query getConfig {
            config {
                certificatePath
            }
        }
    `, {}).catch(formatError);

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
    `, { proxyPort }).catch(formatError);

    return response.interceptors;
}

export async function activateInterceptor(id: string, proxyPort: number) {
    const result = await graphql(`
        mutation Activate($id: ID!, $proxyPort: Int!) {
            activateInterceptor(id: $id, proxyPort: $proxyPort)
        }
    `, { id, proxyPort }).catch(formatError);

    if (!result.activateInterceptor) {
        throw new Error('Failed to activate interceptor');
    }
}

export async function deactivateInterceptor(id: string, proxyPort: number) {
    const result = await graphql(`
        mutation Deactivate($id: ID!, $proxyPort: Int!) {
            deactivateInterceptor(id: $id, proxyPort: $proxyPort)
        }
    `, { id, proxyPort }).catch(formatError);

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
    // We ignore all errors, this trigger is just advisory
    .catch(formatError).catch(console.log);
}
