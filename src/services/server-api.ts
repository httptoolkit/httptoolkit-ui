import { delay, getDeferred } from '../util/promise';
import {
    versionSatisfies,
    SERVER_REST_API_SUPPORTED
} from './service-versions';

import { type ServerConfig, type NetworkInterfaces, type ServerInterceptor, ApiError, ActivationFailure, ActivationNonSuccess } from './server-api-types';
export type { ServerConfig, NetworkInterfaces, ServerInterceptor };

import { GraphQLApiClient } from './server-graphql-api';
import { RestApiClient } from './server-rest-api';
import { RequestDefinition, RequestOptions } from '../model/send/send-request-model';

function getAuthToken() {
    return new URLSearchParams(window.location.search).get('authToken') ?? undefined;
}

const serverReady = getDeferred();
export const announceServerReady = () => serverReady.resolve();
export const waitUntilServerReady = () => serverReady.promise;

let apiClientPromise: Promise<GraphQLApiClient | RestApiClient> | undefined;

function getApiClient(): Promise<GraphQLApiClient | RestApiClient> {
    if (apiClientPromise) return apiClientPromise;

    return apiClientPromise = (async (): Promise<GraphQLApiClient | RestApiClient> => {
        // Wait until the server is up before we start making requests:
        await waitUntilServerReady();

        const authToken = getAuthToken();
        const restClient = new RestApiClient(authToken);
        const graphQLClient = new GraphQLApiClient(authToken);

        // To work out which API is supported, we loop trying to get the version from
        // each one (may take a couple of tries as the server starts up), and then
        // check the resulting version to see what's supported.
        let version: string | undefined;
        while (!version) {
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
}

export async function getServerVersion(): Promise<string> {
    return (await getApiClient()).getServerVersion();
}

export async function getConfig(proxyPort: number): Promise<ServerConfig> {
    return (await getApiClient()).getConfig(proxyPort);
}

export async function getNetworkInterfaces(): Promise<NetworkInterfaces> {
    return (await getApiClient()).getNetworkInterfaces();
}

export async function getInterceptors(proxyPort: number): Promise<ServerInterceptor[]> {
    return (await getApiClient()).getInterceptors(proxyPort);
}

export async function getDetailedInterceptorMetadata<M extends unknown>(
    id: string,
    subId?: string
): Promise<M | undefined> {
    return (await getApiClient()).getDetailedInterceptorMetadata(id, subId);
}

export async function activateInterceptor(id: string, proxyPort: number, options?: any): Promise<unknown> {
    try {
        const result = await (await getApiClient()).activateInterceptor(id, proxyPort, options);

        if (result.success) {
            return result.metadata;
        } else {
            // Some kind of failure (either non-critical, or old server that returned all errors
            // like this without a 500):
            console.log('Activation result', JSON.stringify(result));

            throw new ActivationNonSuccess(id, result.metadata);
        }
    } catch (e: any) {
        if (e instanceof ApiError) {
            throw new ActivationFailure(
                id,
                e.apiError?.message ?? `Failed to activate interceptor ${id}`,
                e.apiError?.code,
                e
            )
        } else {
            throw e;
        }
    }
}

export async function sendRequest(
    requestDefinition: RequestDefinition,
    requestOptions: RequestOptions,
    abortSignal: AbortSignal
) {
    const client = (await getApiClient());
    if (!(client instanceof RestApiClient)) {
        throw new Error("Requests cannot be sent via the GraphQL API client");
    }

    return client.sendRequest(requestDefinition, requestOptions, { abortSignal });
}

export async function triggerServerUpdate() {
    return (await getApiClient()).triggerServerUpdate()
        // We ignore all errors, this trigger is just advisory
        .catch(console.log);
}
