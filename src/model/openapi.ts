import * as _ from 'lodash';

import { OpenAPIObject, PathItemObject, PathObject, findApi, OperationObject, ParameterObject } from 'openapi-directory';

import { HttpExchange } from "../types";
import { firstMatch } from '../util';

const OPENAPI_DIRECTORY_VERSION = require('../../package-lock.json')
    .dependencies['openapi-directory']
    .version;

export interface ApiMetadata {
    spec: OpenAPIObject,
    serverMatcher: RegExp,
    pathMatchers: Map<RegExp, { pathData: PathItemObject, path: string }>
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

    const pathMatchers = new Map<RegExp, { pathData: PathItemObject, path: string }>();
    _.forEach(spec.paths, (pathData, path) => {
        // Build a regex that matches this path on any of those base servers
        pathMatchers.set(
            new RegExp(serverMatcher.source + templateStringToRegexString(path) + '$', 'i'),
            { pathData: pathData, path: path }
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

export function getPath(api: ApiMetadata, exchange: HttpExchange): {
    pathData: PathObject,
    path: string
} | undefined {
    const { parsedUrl } = exchange.request;

    // Request URL without query params
    const url = `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;

    // Test the base server up front, just to keep things quick
    if (!api.serverMatcher.exec(url)) return;

    return [...api.pathMatchers.entries()]
        .filter(([pathMatcher]) => pathMatcher.exec(url))
        .map(([_matcher, path]) => path)[0]; // Should never be ambiguous, but use the first result if it is
}

export interface Parameter {
    name: string;
    description?: string;
    value: unknown;
    required: boolean;
    deprecated: boolean;
    validationErrors: string[];
}

export function getParameters(
    path: string,
    operation: OperationObject,
    exchange: HttpExchange
): Parameter[] {
    const { parameters } = operation;
    if (!parameters) return [];

    const query = exchange.request.parsedUrl.searchParams;

    // Need the cast because TS doesn't know we've already dereferenced this
    return (<ParameterObject[]>parameters)
        .map((param): Parameter | undefined => {
            const commonFields = {
                name: param.name,
                description: param.description,
                required: param.required || param.in === 'path',
                deprecated: param.deprecated || false,
                validationErrors: []
            }

            switch (param.in) {
                case 'query':
                    const values = query.getAll(param.name);
                    return {
                        ...commonFields,
                        value: firstMatch<string[] | string | undefined>(
                            [() => values.length === 0, undefined],
                            [() => values.length === 1, values[0]],
                            [() => true, values]
                        )
                    };

                case 'path':
                    // If we had regex named groups, we could do this up front
                    // with one single regex... Alas, not widespread yet.
                    const paramMatcher = new RegExp(
                        path
                            // Add a capturing group for this param
                            .replace(`{${param.name}}`, '([^/]+)')
                            // Escape any other path variables
                            .replace('{', '\{')
                            .replace('}', '\}')
                        + '$' // Matched path must be a complete suffix.
                    );

                    const match = paramMatcher.exec(exchange.request.path);
                    return {
                        ...commonFields,
                        value: match ? match[1] : undefined
                    };

                case 'header':
                    return {
                        ...commonFields,
                        value: exchange.request.headers[param.name.toLowerCase()]
                    }

                // TODO: Match in:cookie too (but currently no example in the specs)
            }
        })
        .filter((x: any): x is Parameter =>
            !!x && (x.value || x.required)
        );
}