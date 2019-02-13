import * as _ from 'lodash';

import { OpenAPIObject, PathItemObject, PathObject, findApi } from 'openapi-directory';

import { HttpExchange } from "../types";

const OPENAPI_DIRECTORY_VERSION = require('../../package-lock.json')
    .dependencies['openapi-directory']
    .version;

export interface ApiMetadata {
    spec: OpenAPIObject,
    serverMatcher: RegExp,
    pathMatchers: Map<RegExp, PathItemObject>
}

const apiCache: _.Dictionary<Promise<ApiMetadata>> = {};

export function getMatchingAPI(exchange: HttpExchange): Promise<ApiMetadata> | undefined {
    const { parsedUrl } = exchange.request;
    const requestUrl = `${parsedUrl.hostname}${parsedUrl.pathname}`;
    const specId = findApi(requestUrl);

    if (!specId || Array.isArray(specId)) return; // We don't bother dealing with overlapping APIs yet

    if (!apiCache[specId]) {
        apiCache[specId] = buildApiMetadata(specId);
    }

    return apiCache[specId];
}

async function buildApiMetadata(specId: string): Promise<ApiMetadata> {
    const specResponse = await fetch(
        `https://unpkg.com/openapi-directory@${OPENAPI_DIRECTORY_VERSION}/api/${specId}.json`
    );
    const spec: OpenAPIObject = await specResponse.json();

    const serverRegexStrings = spec.servers!.map(s => templateStringToRegexString(s.url));
    // Build a single regex that matches any URL for these base servers
    const serverMatcher = new RegExp(`^(${serverRegexStrings.join('|')})`, 'i');

    const pathMatchers = new Map<RegExp, PathItemObject>();
    _.forEach(spec.paths, (pathDetails, path) => {
        // Build a regex that matches this path on any of those base servers
        pathMatchers.set(
            new RegExp(serverMatcher.source + templateStringToRegexString(path) + '$', 'i'),
            pathDetails
        );
    });

    return {
        spec,
        serverMatcher,
        pathMatchers
    }
}

function templateStringToRegexString(template: string): string {
    return template
        // Replace templates with wildcards
        .replace(/\{([^/}]+)}/g, '([^\/]+)')
        // Drop trailing slashes
        .replace(/\/$/, '');
}

export function getPath(api: ApiMetadata, exchange: HttpExchange): PathObject | undefined {
    const { parsedUrl } = exchange.request;

    // Request URL without query params
    const url = `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;

    // Test the base server up front, just to keep things quick
    if (!api.serverMatcher.exec(url)) return;

    return [...api.pathMatchers.entries()]
        .filter(([pathMatcher]) => pathMatcher.exec(url))
        .map(([_matcher, path]) => path)[0]; // Should never be ambiguous, but use the first result if it is
}