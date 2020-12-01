import * as _ from 'lodash';
import { observable, observe, computed } from "mobx";
import * as localForage from 'localforage';
import * as serializr from 'serializr';
import { findApi as findPublicOpenApi, OpenAPIObject } from 'openapi-directory';

import { HtkRequest } from '../../types';
import { reportError } from '../../errors';
import { lazyObservablePromise } from "../../util/observable";
import { hydrate, persist } from "../../util/mobx-persist/persist";

import { AccountStore } from "../account/account-store";
import { ApiMetadata } from "./build-openapi";
import { buildApiMetadataAsync } from '../../services/ui-worker-api';
import { findBestMatchingApi } from './openapi';
import { serializeRegex, serializeMap } from '../serialization';

async function fetchApiMetadata(specId: string): Promise<OpenAPIObject> {
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

    private publicOpenApiCache: _.Dictionary<Promise<ApiMetadata>> = {};

    private getPublicApi(specId: string) {
        const { publicOpenApiCache } = this;
        if (!publicOpenApiCache[specId]) {
            publicOpenApiCache[specId] = fetchApiMetadata(specId)
                .then(buildApiMetadataAsync)
                .catch((e) => {
                    console.log(`Failed to build API ${specId}`);
                    reportError(e, {
                        apiSpecId: specId
                    });
                    throw e;
                });
        }
        return publicOpenApiCache[specId];
    }

    async getApi(request: HtkRequest): Promise<ApiMetadata | undefined> {
        const { parsedUrl, url } = request;

        // Is this a configured private API? I.e. has the user explicitly given
        // us a spec to use for requests like these.
        let privateSpec = this.getPrivateApi(parsedUrl);
        if (privateSpec) {
            return Promise.resolve(privateSpec);
        }

        // If not, is this a known public API? (note that private always has precedence)
        const requestUrl = `${parsedUrl.hostname}${parsedUrl.pathname}`;

        let publicSpecId = findPublicOpenApi(requestUrl);

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