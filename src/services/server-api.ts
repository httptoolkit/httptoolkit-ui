import * as localForage from 'localforage';

import { RUNNING_IN_WORKER } from '../util';
import { delay, getDeferred } from '../util/promise';
import {
    versionSatisfies,
    SERVER_REST_API_SUPPORTED
} from './service-versions';

import { type ServerConfig, type NetworkInterfaces, type ServerInterceptor, ApiError } from './server-api-types';
export type { ServerConfig, NetworkInterfaces, ServerInterceptor };

import { GraphQLApiClient } from './server-graphql-api';
import { RestApiClient } from './server-rest-api';
import { RequestDefinition, RequestOptions } from '../model/send/send-request-model';

async function getAuthToken() {
    if (!RUNNING_IN_WORKER) {
        return Promise.resolve(
            new URLSearchParams(window.location.search).get('authToken') ?? undefined
        );
    }

    // For workers, the UI shares the auth token with SW via IDB:
    const authToken = await localForage.getItem<string>('latest-auth-token')
    if (authToken) return authToken;
}

const serverReady = getDeferred();
export const announceServerReady = () => serverReady.resolve();
export const waitUntilServerReady = () => serverReady.promise;

const apiClient = (async (): Promise<GraphQLApiClient | RestApiClient> => {
    // Delay checking, just to avoid spamming requests that we know won't work. Doesn't work in
    // the update SW, which doesn't get a server-ready ping, so just wait a bit:
    if (!RUNNING_IN_WORKER) await waitUntilServerReady();
    else await delay(5000);

    // To work out which API is supported, we loop trying to get the version from
    // each one (may take a couple of tries as the server starts up), and then
    // check the resulting version to see what's supported.

    let version: string | undefined;
    while (!version) {
        // Reload auth token each time. For main UI it'll never change (but load is instant),
        // while for SW there's a race so we need to reload just in case:
        const authToken = await getAuthToken();

        const restClient = new RestApiClient(authToken);
        const graphQLClient = new GraphQLApiClient(authToken);

        version = await restClient.getServerVersion().catch(() => {
            console.log("Couldn't get version from REST API");

            return graphQLClient.getServerVersion().catch(() => {
                console.log("Couldn't get version from GraphQL API");
                return undefined;
            });
        });

        if (version) {
            if (versionSatisfies(version, SERVER_REST_API_SUPPORTED)) {
                return restClient;
            } else {
                return graphQLClient;
            }
        } else {
            // Wait a little then try again:
            await delay(100);
        }
    }

    throw new Error(`Unreachable error: got version ${version} but couldn't pick an API client`);
})();

export async function getServerVersion(): Promise<string> {
    return (await apiClient).getServerVersion();
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
