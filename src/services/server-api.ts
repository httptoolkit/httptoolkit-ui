import * as localForage from 'localforage';

import { RUNNING_IN_WORKER } from '../util';
import { getDeferred } from '../util/promise';
import {
    versionSatisfies,
    SERVER_REST_API_SUPPORTED
} from './service-versions';

import { type ServerConfig, type NetworkInterfaces, type ServerInterceptor, ApiError } from './server-api-types';
export { ServerConfig, NetworkInterfaces, ServerInterceptor };

import { GraphQLApiClient } from './server-graphql-api';
import { RestApiClient } from './server-rest-api';
import { RequestDefinition, RequestOptions } from '../model/send/send-request-model';

const authTokenPromise = !RUNNING_IN_WORKER
    // Main UI gets given the auth token directly in its URL:
    ? Promise.resolve(new URLSearchParams(window.location.search).get('authToken') ?? undefined)
    // For workers, the new (March 2020) UI shares the auth token with SW via IDB:
    : localForage.getItem<string>('latest-auth-token')
        .then((authToken) => {
            if (authToken) return authToken;

            // Old UI (Jan-March 2020) shares auth token via SW query param:
            const workerParams = new URLSearchParams(
                (self as unknown as WorkerGlobalScope).location.search
            );
            return workerParams.get('authToken') ?? undefined;

            // Pre-Jan 2020 UI doesn't share auth token - ok with old desktop, fails with 0.1.18+.
        });

const serverReady = getDeferred();
export const announceServerReady = () => serverReady.resolve();
export const waitUntilServerReady = () => serverReady.promise;

// We initially default to the GQL API. If at the first version lookup we discover that the REST
// API is supported, this is swapped out for the REST client instead. Both work, but REST is the
// goal long-term so should be preferred where available.
let apiClient: Promise<GraphQLApiClient | RestApiClient> = authTokenPromise
    .then((authToken) => new GraphQLApiClient(authToken));
export async function getServerVersion(): Promise<string> {
    const client = await apiClient;
    const version = await client.getServerVersion();

    // Swap to the REST client if we receive a version where it's supported:
    if (versionSatisfies(version, SERVER_REST_API_SUPPORTED) && client instanceof GraphQLApiClient) {
        apiClient = authTokenPromise
            .then((authToken) => new RestApiClient(authToken));
    }

    return version;
}

export async function getConfig(proxyPort: number): Promise<ServerConfig> {
    return (await apiClient).getConfig(proxyPort);
}

export async function getNetworkInterfaces(): Promise<NetworkInterfaces> {
    return (await apiClient).getNetworkInterfaces();
}

export async function getInterceptors(proxyPort: number): Promise<ServerInterceptor[]> {
    return (await apiClient).getInterceptors(proxyPort);
}

export async function getDetailedInterceptorMetadata<M extends unknown>(id: string): Promise<M | undefined> {
    return (await apiClient).getDetailedInterceptorMetadata(id);
}

export async function activateInterceptor(id: string, proxyPort: number, options?: any): Promise<unknown> {
    const result = await (await apiClient).activateInterceptor(id, proxyPort, options);

    if (result.success) {
        return result.metadata;
    } else {
        // Some kind of failure:
        console.log('Activation result', JSON.stringify(result));

        const error = Object.assign(
            new ApiError(`failed to activate interceptor ${id}`, `activate-interceptor-${id}`),
            result
        );

        throw error;
    }
}

export async function sendRequest(
    requestDefinition: RequestDefinition,
    requestOptions: RequestOptions
) {
    const client = (await apiClient);
    if (!(client instanceof RestApiClient)) {
        throw new Error("Requests cannot be sent via the GraphQL API client");
    }

    return client.sendRequest(requestDefinition, requestOptions);
}

export async function triggerServerUpdate() {
    return (await apiClient).triggerServerUpdate()
        // We ignore all errors, this trigger is just advisory
        .catch(console.log);
}
