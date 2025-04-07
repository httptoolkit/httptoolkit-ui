import * as _ from 'lodash';
import { observable, observe, computed } from "mobx";
import * as localForage from 'localforage';
import * as serializr from 'serializr';
import { findApi as findPublicOpenApi } from 'openapi-directory';

import { HtkRequest } from '../../types';
import { logError } from '../../errors';
import { lazyObservablePromise } from "../../util/observable";
import { hydrate, persist } from "../../util/mobx-persist/persist";

import { AccountStore } from "../account/account-store";
import { ApiMetadata, ApiSpec } from "./api-interfaces";
import { buildApiMetadataAsync } from '../../services/ui-worker-api';
import { matchOpenApiOperation } from './openapi';
import { serializeRegex, serializeMap } from '../serialization';

async function fetchApiMetadata(specId: string): Promise<ApiSpec> {
    const specResponse = await fetch(`/api/${specId}.json`);
    return specResponse.json();
}

const apiMetadataSchema = serializr.createSimpleSchema({
    spec: serializr.raw(),
    serverMatcher: serializeRegex,
    requestMatchers: serializeMap(
        serializr.object(
            serializr.createSimpleSchema({
                pathMatcher: serializeRegex,
                queryMatcher: serializr.raw()
            })
        ),
        serializr.custom(
            ({ path }: { path: string }) => path,
            (path: string, context: serializr.Context) => ({
                path,
                pathSpec: context.json.spec.paths[path]
            })
        )
    )
});

// In addition to the public OpenAPI directory, we have a few extra APIs (stored in
// this repo in /extra-apis) that we match separately:
const EXTRA_APIS: { [urlPrefix: string]: 'ipfs' | 'ethereum' } = {
    // See the 'servers' field in /extra-apis/ipfs.json:
    'localhost:5001/api/v0': 'ipfs',
    '127.0.0.1:5001/api/v0': 'ipfs',
    'localhost:5002/api/v0': 'ipfs',
    '127.0.0.1:5002/api/v0': 'ipfs',
    'ipfs.infura.io:5001/api/v0': 'ipfs',

    // See the 'servers' field in /extra-apis/ethereum.json:
    'localhost:8545/': 'ethereum',
    '127.0.0.1:8545/': 'ethereum',
    'mainnet.': 'ethereum',
    'ropsten.': 'ethereum',
    'rinkeby.': 'ethereum',
    'kovan.': 'ethereum',
    'goerli.': 'ethereum',
    'mainnet-': 'ethereum',
    'web3.ens.domains/v1/mainnet': 'ethereum'
};

function findPublicApi(url: string) {
    const openApiId = findPublicOpenApi(url);

    if (openApiId) return openApiId;

    const matchingExtraApiKey = Object.keys(EXTRA_APIS)
        .find((apiPrefix) => url.startsWith(apiPrefix));

    if (matchingExtraApiKey) return EXTRA_APIS[matchingExtraApiKey];
    else return undefined;
}

export class ApiStore {

    constructor(
        private accountStore: AccountStore
    ) { }

    readonly initialized = lazyObservablePromise(async () => {
        await this.accountStore.initialized;

        // Every time the user account data is updated from the server, consider resetting
        // paid settings to the free defaults. This ensures that they're reset on
        // logout & subscription expiration (even if that happened while the app was
        // closed), but don't get reset when the app starts with stale account data.
        observe(this.accountStore, 'accountDataLastUpdated', () => {
            if (!this.accountStore.isPaidUser) this.customOpenApiSpecs = {};
        });

        await hydrate({
            // Stored in WebSQL, not local storage, for performance because specs can be *big*
            storage: localForage,
            jsonify: false,
            key: 'api-store',
            store: this
        });

        console.log('API store initialized');
    });

    @persist('map', apiMetadataSchema) @observable.shallow
    private customOpenApiSpecs: _.Dictionary<ApiMetadata> = {};

    addCustomApi(baseUrl: string, apiMetadata: ApiMetadata) {
        this.customOpenApiSpecs[baseUrl] = apiMetadata;
    }

    deleteCustomApi(baseUrl: string) {
        delete this.customOpenApiSpecs[baseUrl];
    }

    // Exposes the info from all openAPI specs, for convenient listing
    // Not the whole spec because we want to clone, that'd be expensive,
    // and in general nobody should ever iterate over the details of all specs
    @computed get customOpenApiInfo() {
        return _.mapValues(this.customOpenApiSpecs, (api) => ({
            info: _.cloneDeep(api.spec.info)
        }));
    }

    @computed private get customOpenApiSpecsByUrl() {
        return new Map<URL, ApiMetadata>(
            (Object.entries(this.customOpenApiSpecs).map(([rawUrl, spec]) => {
                // We want to prepare the base URLs for easy lookup. We need a protocol
                // to parse them, so we use https, but these will match HTTP too.
                return [
                    new URL('https://' + rawUrl.replace(/\/$/, '')),
                    spec
                ];
            }) as Array<[URL, ApiMetadata]>)
            .sort(([urlA, _apiA], [urlB, _apiB]) => {
                // Ports before non-ports, then longer paths before shorter ones.
                if (urlA.port && !urlB.port) return -1;
                if (urlB.port && !urlA.port) return 1;
                return urlB.pathname.length - urlA.pathname.length;
            })
        );
    }

    private getPrivateApi(url: URL) {
        // Find a base URL with the same domain, maybe port, and initial path substring
        const apiBaseUrl = _.find([...this.customOpenApiSpecsByUrl.keys()], (baseUrl) => {
            return baseUrl.hostname === url.hostname &&
                (
                    !baseUrl.port ||
                    baseUrl.port === url.port ||
                    baseUrl.port === '443' && url.protocol === 'https' ||
                    baseUrl.port === '80' && url.protocol === 'http'
                ) &&
                url.pathname.startsWith(baseUrl.pathname)
        });

        return apiBaseUrl
            ? this.customOpenApiSpecsByUrl.get(apiBaseUrl)
            : undefined;
    }

    private publicApiCache: _.Dictionary<Promise<ApiMetadata>> = {};

    private getPublicApi(specId: string) {
        const { publicApiCache } = this;
        if (!publicApiCache[specId]) {
            publicApiCache[specId] = fetchApiMetadata(specId)
                .then(buildApiMetadataAsync)
                .catch((e) => {
                    if (e.message === 'Failed to fetch') {
                        // This is a network error, not a spec error. Don't log it.
                        console.warn('Failed to fetch API spec', specId, e);
                        throw e;
                    }

                    console.log(`Failed to build API ${specId}`);
                    logError(e, {
                        apiSpecId: specId
                    });
                    throw e;
                });
        }
        return publicApiCache[specId];
    }

    async getApi(request: HtkRequest): Promise<ApiMetadata | undefined> {
        const { parsedUrl } = request;

        // Some specs (e.g. lots of GitHub Enterprise API specs incorrectly match the GitHub public
        // website. That's not correct or useful - we special case ignore it here.
        if (parsedUrl.hostname === 'github.com') return;

        // Is this a configured private API? I.e. has the user explicitly given
        // us a spec to use for requests like these.
        let privateSpec = this.getPrivateApi(parsedUrl);
        if (privateSpec) {
            return Promise.resolve(privateSpec);
        }

        // If not, is this a known public API? (note that private always has precedence)
        const requestUrl = `${parsedUrl.host}${parsedUrl.pathname}`;

        let publicSpecId = findPublicApi(requestUrl);
        if (!publicSpecId) return;
        if (!Array.isArray(publicSpecId)) publicSpecId = [publicSpecId];

        // The graph API is enormous and doesn't actually build due to
        // https://github.com/microsoftgraph/microsoft-graph-openapi/issues/9.
        // Skip it rather than waiting ages before failing anyway.
        publicSpecId = publicSpecId.filter(specId => specId !== 'microsoft.com/graph');

        const publicSpecs = await Promise.all(
            publicSpecId.map((specId) => this.getPublicApi(specId))
        );

        if (publicSpecs.length === 1) {
            return publicSpecs[0];
        }

        // If this matches multiple APIs, we fetch and build all of them, and then
        // use the best match (the one with the matching operation, hopefully)
        return findBestMatchingApi(publicSpecs, request);
    }

}

// If we match multiple APIs, build all of them, try to match each one
// against the request, and return only the matching one. This happens if
// multiple services have the exact same base request URL (rds.amazonaws.com)
export function findBestMatchingApi(
    apis: ApiMetadata[],
    request: HtkRequest
): ApiMetadata | undefined {
    const matchingApis = apis.filter((api) =>
        api.type == 'openrpc' || // Since we have so few JSON-RPC APIs, we assume they match
        matchOpenApiOperation(api, request).matched // For OpenAPI, we check for a matching op
    );

    // If we've successfully found one matching API, return it
    if (matchingApis.length === 1) return matchingApis[0];

    // If this is a non-matching request to one of these APIs, but we're not
    // sure which, return the one with the most paths (as a best guess metric of
    // which is the most popular service)
    if (matchingApis.length === 0) return _.maxBy(apis, a => a.spec.paths.length)!;

    // Otherwise we've matched multiple APIs which all define operations that
    // could be this one request. Does exist right now (e.g. AWS RDS vs DocumentDB)

    // Report this so we can try to improve & avoid in future.
    logError('Overlapping APIs', matchingApis);

    // Return our guess of the most popular service, from the matching services only
    return _.maxBy(matchingApis, a => Object.keys(a.spec.paths).length)!;
}