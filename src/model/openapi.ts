import * as _ from 'lodash';
import { get } from 'typesafe-get';

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
        apiCache[specId] = fetchApiMetadata(specId).then(buildApiMetadata);
    }

    return apiCache[specId];
}

async function fetchApiMetadata(specId: string): Promise<OpenAPIObject> {
    const specResponse = await fetch(
        `https://unpkg.com/openapi-directory@${OPENAPI_DIRECTORY_VERSION}/api/${specId}.json`
    );
    return specResponse.json();
}

export function buildApiMetadata(spec: OpenAPIObject): ApiMetadata {
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
        .map((param) => {
            const commonFields = {
                specParam: param,
                name: param.name,
                description: param.description,
                required: param.required || param.in === 'path',
                deprecated: param.deprecated || false,
                validationErrors: <string[]>[]
            }

            switch (param.in) {
                case 'query':
                    const values = query.getAll(param.name);
                    return {
                        ...commonFields,
                        value: firstMatch<string[] | string | undefined>(
                            [() => values.length > 1, values],
                            [() => values.length === 1, values[0]]
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
                default:
                    return {
                        ...commonFields,
                        value: undefined
                    }
            }
        })
        .map((param) => {
            if (param.required && !param.value) {
                param.validationErrors.push(
                    `The '${param.name}' ${param.specParam.in} parameter is required.`
                );
            }
            if (param.deprecated && !!param.value) {
                param.validationErrors.push(
                    `The '${param.name}' ${param.specParam.in} parameter is deprecated.`
                );
            }
            return param;
        });
}

export interface ApiExchange {
    serviceTitle: string;
    serviceLogoUrl?: string;

    operationName: string;
    operationDescription?: string;
    operationDocsUrl?: string;

    parameters: Parameter[];
}

function getDummyPath(api: ApiMetadata, exchange: HttpExchange): string {
    const { parsedUrl } = exchange.request;
    const url = `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;
    const serverMatch = api.serverMatcher.exec(url);

    if (!serverMatch) {
        return parsedUrl.pathname
    }

    // Everything after the server is our API path
    return url.slice(serverMatch[0].length);
}

export function parseExchange(api: ApiMetadata, exchange: HttpExchange): ApiExchange {
    const { info: service } = api.spec;

    const serviceTitle = service.title;
    const serviceLogoUrl = service['x-logo'].url

    const matchingPath = getPath(api, exchange);

    const { pathData, path } = matchingPath || {
        pathData: {}, path: getDummyPath(api, exchange)
    }

    const operation: OperationObject | _.Dictionary<never> = get(
        pathData, exchange.request.method.toLowerCase()
    ) || {};

    const operationDocsUrl = firstMatch(
        get(operation, 'externalDocs', 'url'),
        get(api, 'spec', 'externalDocs', 'url')
    );

    const operationName = firstMatch<string>(
        get(operation, 'summary'),
        get(operation, 'operationId'),
        [
            () => (get(operation, 'description', 'length') || Infinity) < 40, operation.description!
        ],
        pathData.summary
    ) || `${exchange.request.method} ${path}`;

    const operationDescription = firstMatch<string>(
        [() => get(operation, 'description') !== operationName, get(operation, 'description')],
        [() => get(operation, 'summary') !== operationName, get(operation, 'summary')],
        pathData.description,
        service.description
    );

    const parameters = operation ? getParameters(
        path!, operation as OperationObject, exchange
    ) : [];

    return {
        serviceTitle,
        serviceLogoUrl,
        operationName,
        operationDescription,
        operationDocsUrl,
        parameters
    };
}