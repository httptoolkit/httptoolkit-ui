import * as getGraphQL from 'graphql.js';

const graphql = getGraphQL('http://localhost:4000/', { asJSON: true });

export async function getVersion() {
    const response = await graphql(`
        query getVersion {
            version
        }
    `, {});

    return response.version;
}

export async function getInterceptors(proxyPort: number) {
    const response = await graphql(`
        query getInterceptors($proxyPort: Int!) {
            interceptors {
                id
                version
                isActive(proxyPort: $proxyPort)
                isActivable
            }
        }
    `, { proxyPort });

    return response.interceptors;
}

export async function activateInterceptor(id: string, proxyPort: number) {
    const result = await graphql(`
        mutation Activate($id: ID!, $proxyPort: Int!) {
            activateInterceptor(id: $id, proxyPort: $proxyPort)
        }
    `, { id, proxyPort });

    if (!result.activateInterceptor) {
        throw new Error('Failed to activate interceptor');
    }
}

export async function deactivateInterceptor(id: string, proxyPort: number) {
    const result = await graphql(`
        mutation Deactivate($id: ID!, $proxyPort: Int!) {
            deactivateInterceptor(id: $id, proxyPort: $proxyPort)
        }
    `, { id, proxyPort });

    if (!result.deactivateInterceptor) {
        throw new Error('Failed to deactivate interceptor');
    }
}