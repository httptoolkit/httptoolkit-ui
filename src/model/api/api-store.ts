import * as _ from 'lodash';
import { create } from "mobx-persist";
import * as localForage from 'localforage';
import { findApi as findPublicOpenApi, OpenAPIObject } from 'openapi-directory';


import { HtkRequest } from '../../types';
import { reportError } from '../../errors';
import { lazyObservablePromise } from "../../util/observable";

import { AccountStore } from "../account/account-store";
import { ApiMetadata } from "./build-openapi";
import { buildApiMetadataAsync } from '../../services/ui-worker-api';
import { findBestMatchingApi } from './openapi';

async function fetchApiMetadata(specId: string): Promise<OpenAPIObject> {
    const specResponse = await fetch(`/api/${specId}.json`);
    return specResponse.json();
}

export class ApiStore {

    constructor(
        private accountStore: AccountStore
    ) { }

    readonly initialized = lazyObservablePromise(async () => {
        await this.accountStore.initialized;

        await create({
            // Stored in WebSQL, not local storage, for performance because specs can be *big*
            storage: localForage,
            jsonify: false
        })('api-store', this);

        console.log('API store initialized');
    });

    private publicOpenApiCache: _.Dictionary<Promise<ApiMetadata>> = {};

    private getPublicApi(specId: string) {
        const { publicOpenApiCache } = this;
        if (!publicOpenApiCache[specId]) {
            publicOpenApiCache[specId] = fetchApiMetadata(specId)
                .then(buildApiMetadataAsync)
                .catch((e) => {
                    reportError(e);
                    throw e;
                });
        }
        return publicOpenApiCache[specId];
    }

    async getApi(request: HtkRequest): Promise<ApiMetadata | undefined> {
        const { parsedUrl } = request;

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