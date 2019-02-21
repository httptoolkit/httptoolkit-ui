import * as _ from 'lodash';
import { get } from 'typesafe-get';

import {
    findApi,
    OpenAPIObject,
    PathItemObject,
    PathObject,
    OperationObject,
    ParameterObject,
    ResponseObject,
    RequestBodyObject,
    SchemaObject
} from 'openapi-directory';
import * as Ajv from 'ajv';
import deref from 'json-schema-deref-sync';
import * as Remarkable from 'remarkable';
import * as DOMPurify from 'dompurify';

import { HttpExchange, HtkResponse, HtkRequest } from "../types";
import { firstMatch } from '../util';

const OPENAPI_DIRECTORY_VERSION = require('val-loader!../package-lock')['openapi-directory'];

const ajv = new Ajv({
    coerceTypes: true
});

const md = new Remarkable({
    html: true,
    linkify: true
});

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
    return deref(await specResponse.json(), {
        failOnMissing: true
    });
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

interface Html {
    __html: string
}

export interface Parameter {
    name: string;
    description?: Html;
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
                description: fromMarkdown(param.description),
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
                        + '$', // Matched path must be a complete suffix.
                        'i' // Match paths ignoring case (matters in theory, never in practice)
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
            const { specParam } = param;
            if (specParam.schema) {
                // Validate against the schema. We wrap the value in an object
                // so that ajv can mutate the input to coerce to the right type.
                const valueWrapper = { value: param.value };
                const validated = ajv.validate({
                    "type": "object",
                    "properties": {
                        "value": specParam.schema
                    }
                }, valueWrapper);

                if (!validated && ajv.errors) {
                    param.validationErrors.push(
                        ...ajv.errors.map(e =>
                            `'${
                            _.upperFirst(e.dataPath.replace(/^\.value/, param.name))
                            }' ${e.message!}.`
                        )
                    );
                }

                param.value = valueWrapper.value;
            }

            if (param.required && !param.value) {
                param.validationErrors.push(
                    `The '${param.name}' ${specParam.in} parameter is required.`
                );
            }

            if (param.deprecated && !!param.value) {
                param.validationErrors.push(
                    `The '${param.name}' ${specParam.in} parameter is deprecated.`
                );
            }

            return {
                ...param,
                validationErrors: param.validationErrors.map(stripTags)
            };
        });
}

export function getBody(
    bodyDefinition: RequestBodyObject | ResponseObject | undefined,
    message: HtkRequest | HtkResponse | 'aborted' | undefined
): SchemaObject {
    if (!bodyDefinition || !message || message === 'aborted') return {};

    const contentType = message.headers['content-type'] || '*/*';

    const schemasByType = bodyDefinition.content;
    if (!schemasByType) return {};

    // Sort the keys by the number of *'s present
    const mediaTypeKeys = _.sortBy(Object.keys(schemasByType),
        (key) => _.sumBy(key, (c: string) => c === '*' ? 1 : 0)
    );

    const schemaKey = _.find<string>(mediaTypeKeys, (key) =>
        new RegExp('^' + // Must match at the start
            key.replace('*', '.*') // Wildcards to regex wildcard
                .replace(/;.*/, '') // Ignore charset etc
        ).exec(contentType) !== null
    );

    if (!schemaKey) return {};

    return Object.assign(
        { description: bodyDefinition.description },
        schemasByType[schemaKey].schema
    );
}

export interface ApiExchange {
    serviceTitle: string;
    serviceLogoUrl?: string;
    serviceDescription?: Html;

    operationName: Html;
    operationDescription?: Html;
    operationDocsUrl?: string;

    parameters: Parameter[];
    requestBody?: SchemaObject;

    responseDescription?: Html;
    responseBody?: SchemaObject;

    validationErrors: string[];
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

function isCompletedResponse(response: any): response is HtkResponse {
    return !!response.statusCode;
}

function fromMarkdown(input: string): Html;
function fromMarkdown(input: string | undefined): Html | undefined;
function fromMarkdown(input: string | undefined): Html | undefined {
    if (!input) return undefined;
    else {
        const unsafeMarkdown = md.render(input).replace(/\n$/, '');
        const safeHtml = DOMPurify.sanitize(unsafeMarkdown);
        return { __html: safeHtml };
    }
}

// Rough but effective HTML stripping regex. This is _not_ designed to produce HTML-safe
// input, it's just designed to turn formatted text into simple text.
function stripTags(input: string): string {
    return input.replace(/(<([^>]+)>)/ig, '');
}

export function parseExchange(api: ApiMetadata, exchange: HttpExchange): ApiExchange {
    const { info: service } = api.spec;
    const { request, response } = exchange;

    const validationErrors: string[] = [];

    const serviceTitle = service.title;
    const serviceLogoUrl = service['x-logo'].url
    const serviceDescription = fromMarkdown(service.description);

    const matchingPath = getPath(api, exchange);

    const { pathData, path } = matchingPath || {
        pathData: {}, path: getDummyPath(api, exchange)
    }

    const operation: OperationObject | _.Dictionary<never> = get(
        pathData, request.method.toLowerCase()
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
    ) || `${request.method} ${path}`;

    const operationDescription = firstMatch<string>(
        [() => get(operation, 'description') !== operationName, get(operation, 'description')],
        [() => get(operation, 'summary') !== operationName, get(operation, 'summary')],
        pathData.description
    );

    if (operation.deprecated) validationErrors.push(
        `The '${stripTags(fromMarkdown(operationName).__html)}' operation is deprecated`
    );

    const parameters = operation ? getParameters(
        path!, operation as OperationObject, exchange
    ) : [];

    let responseSpec: ResponseObject | undefined;
    let responseDescription: string | undefined;
    if (get(operation, 'responses') && isCompletedResponse(response)) {
        responseSpec = operation.responses[response.statusCode.toString()] ||
            operation.responses.default;
        responseDescription = responseSpec ? responseSpec.description : response.statusMessage;
    }

    return {
        serviceTitle,
        serviceLogoUrl,
        serviceDescription,
        operationName: fromMarkdown(operationName),
        operationDescription: fromMarkdown(operationDescription),
        operationDocsUrl,
        parameters,
        requestBody: getBody(operation.requestBody as RequestBodyObject | undefined, exchange.request),
        responseDescription: fromMarkdown(responseDescription),
        responseBody: getBody(responseSpec, exchange.response),
        validationErrors: validationErrors.map(stripTags)
    };
}