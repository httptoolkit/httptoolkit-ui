import * as _ from 'lodash';
import { get } from 'typesafe-get';

import type {
    OpenAPIObject,
    PathObject,
    OperationObject,
    ParameterObject,
    ResponseObject,
    RequestBodyObject,
    SchemaObject,
    ParameterLocation
} from 'openapi-directory';
import * as Ajv from 'ajv';

import {
    HttpExchange,
    ExchangeMessage,
    HtkRequest,
    HtkResponse,
    Html
} from "../../types";
import { firstMatch, empty, lastHeader } from '../../util';
import { formatAjvError } from '../../util/json-schema';
import { reportError } from '../../errors';

import { ApiMetadata } from './build-openapi';
import { fromMarkdown } from '../markdown';

const paramValidator = new Ajv({
    coerceTypes: 'array',
    unknownFormats: 'ignore' // OpenAPI uses some non-standard formats
});

// If we match multiple APIs, build all of them, try to match each one
// against the request, and return only the matching one. This happens if
// multiple services have the exact same base request URL (rds.amazonaws.com)
export function findBestMatchingApi(apis: ApiMetadata[], request: HtkRequest): ApiMetadata | undefined {
    const matchingApis = apis.filter((api) => matchOperation(api, request).matched);

    // If we've successfully found one matching API, return it
    if (matchingApis.length === 1) return matchingApis[0];

    // If this is a non-matching request to one of these APIs, but we're not
    // sure which, return the one with the most paths (as a best guess metric of
    // which is the most popular service)
    if (matchingApis.length === 0) return _.maxBy(apis, a => a.spec.paths.length)!;

    // Otherwise we've matched multiple APIs which all define operations that
    // could be this one request. Does exist right now (e.g. AWS RDS vs DocumentDB)

    // Report this so we can try to improve & avoid in future.
    reportError('Overlapping APIs', matchingApis);

    // Return our guess of the most popular service, from the matching services only
    return _.maxBy(matchingApis, a => a.spec.paths.length)!;
}

function getPath(api: ApiMetadata, request: HtkRequest): {
    pathSpec: PathObject,
    path: string
} | undefined {
    const { parsedUrl } = request;

    // Request URL without query params
    const url = `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;

    // Test the base server up front, just to keep things quick
    if (!api.serverMatcher.exec(url)) return;

    for (let matcher of api.requestMatchers.keys()) {
        // Check the path matches
        if (!matcher.pathMatcher.exec(url)) continue;

        // Check the query fragment matches (if there is one)
        if (!_.every(matcher.queryMatcher, (expectedValue, query) => {
            const queryValues = parsedUrl.searchParams.getAll(query);
            if (!expectedValue) {
                return queryValues.length > 0;
            } else if (typeof expectedValue === 'string') {
                return _.includes(queryValues, expectedValue);
            } else {
                return _.intersection(queryValues, expectedValue).length === expectedValue.length;
            }
        })) continue;

        // First match is the right one (we sort in build-api to
        // guarantee more specific matches always come first).
        return api.requestMatchers.get(matcher)!;
    }
}

export function getParameters(
    path: string,
    parameters: ParameterObject[],
    request: HtkRequest
): Parameter[] {
    if (!parameters) return [];

    const query = request.parsedUrl.searchParams;

    // Need the cast because TS doesn't know we've already dereferenced this
    return _.uniqBy(<ParameterObject[]>parameters, (param) =>
        `${param.name}::${param.in}`
    )
        .map((param) => {
            const schema = param.schema as SchemaObject | undefined;

            const commonFields = {
                specParam: param,
                name: param.name,
                in: param.in,
                description: fromMarkdown(param.description),
                required: param.required || param.in === 'path',
                type: schema && schema.type,
                defaultValue: schema && schema.default,
                enum: schema && (schema.enum || (schema.items && (schema.items as SchemaObject).enum)),
                deprecated: param.deprecated || false,
                warnings: <string[]>[]
            }

            switch (param.in) {
                case 'query':
                    let values: Array<string | boolean> = query.getAll(param.name);

                    // For a boolean field, empty-but-set (?myParam) means true
                    if (commonFields.type && commonFields.type === 'boolean' && param.allowEmptyValue) {
                        values = values.map((v) => v === '' ? true : v);
                    }

                    return {
                        ...commonFields,
                        value: firstMatch<Array<string | boolean> | string | boolean | undefined>(
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
                            // Add a non-capturing group for every other param
                            .replace(/\{[^\}]+\}/g, '[^/]+')
                        + '$', // Matched path must be a complete suffix.
                        'i' // Match paths ignoring case (matters in theory, never in practice)
                    );

                    const match = paramMatcher.exec(request.parsedUrl.pathname);
                    return {
                        ...commonFields,
                        value: match ? match[1] : undefined
                    };

                case 'header':
                    return {
                        ...commonFields,
                        value: request.headers[param.name.toLowerCase()]
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

            const serializationStyle = specParam.style || ({
                query: 'form',
                path: 'simple',
                header: 'simple',
                cookie: 'form'
            }[specParam.in]);

            if (param.type === 'array') {
                if (
                    serializationStyle === 'simple' ||
                    (serializationStyle === 'form' && specParam.explode === false)
                ) {
                    param.value = _.isString(param.value) ? param.value.split(',') : param.value;
                }
                if (serializationStyle === 'spaceDelimited') {
                    param.value = _.isString(param.value) ? param.value.split(' ') : param.value;
                }
                if (serializationStyle === 'pipeDelimited') {
                    param.value = _.isString(param.value) ? param.value.split('|') : param.value;
                }
            }

            if (param.required && param.value === undefined && param.defaultValue === undefined) {
                param.warnings.push(
                    `The '${param.name}' ${specParam.in} parameter is required.`
                );
            }

            if (param.deprecated && param.value !== undefined) {
                param.warnings.push(
                    `The '${param.name}' ${specParam.in} parameter is deprecated.`
                );
            }

            if (specParam.schema && param.value !== undefined) {
                // Validate against the schema. We wrap the value in an object
                // so that ajv can mutate the input to coerce to the right type.
                const valueWrapper = { value: param.value };
                const validated = paramValidator.validate({
                    "type": "object",
                    "properties": {
                        "value": specParam.schema
                    }
                }, valueWrapper);

                if (!validated && paramValidator.errors) {
                    param.warnings.push(
                        ...paramValidator.errors.map(e =>
                            formatAjvError(valueWrapper, e, (path) => path.replace(/^\.value/, param.name))
                        )
                    );
                }

                param.value = valueWrapper.value;
            }

            return {
                ...param,
                warnings: param.warnings.map(e => stripTags(e))
            };
        });
}

export function getBodySchema(
    spec: OpenAPIObject,
    bodyDefinition: RequestBodyObject | ResponseObject | undefined,
    message: ExchangeMessage | 'aborted' | undefined
): SchemaObject {
    if (!bodyDefinition || !message || message === 'aborted') return {};

    const contentType = lastHeader(message.headers['content-type']) || '*/*';

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
        {
            description: bodyDefinition.description,
            components: spec.components
        },
        schemasByType[schemaKey].schema
    );
}

function getDummyPath(api: ApiMetadata, request: HtkRequest): string {
    const { parsedUrl } = request;
    const url = `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;
    const serverMatch = api.serverMatcher.exec(url);

    if (!serverMatch) {
        return parsedUrl.pathname;
    }

    // Everything after the server is our API path
    return url.slice(serverMatch[0].length);
}

// Rough but effective HTML stripping regex. This is _not_ designed to produce HTML-safe
// input, it's just designed to turn formatted text into simple text.
function stripTags(input: string): string;
function stripTags(input: undefined): undefined;
function stripTags(input: string | undefined): string | undefined {
    if (!input) return input;
    return input.replace(/(<([^>]+)>)/ig, '');
}

export class ApiExchange {
    constructor(api: ApiMetadata, exchange: HttpExchange) {
        const { request } = exchange;
        this.service = new ApiService(api.spec);

        this._spec = api.spec;
        this._opSpec = matchOperation(api, request);

        this.operation = new ApiOperation(this._opSpec);
        this.request = new ApiRequest(api.spec, this._opSpec, request);

        if (exchange.response) {
            this.updateWithResponse(exchange.response);
        }
    }

    private _spec: OpenAPIObject;
    private _opSpec: MatchedOperation;

    public readonly service: ApiService;
    public readonly operation: ApiOperation;
    public readonly request: ApiRequest;

    public response: ApiResponse | undefined;

    updateWithResponse(response: HtkResponse | 'aborted' | undefined): void {
        if (response === 'aborted' || response === undefined) return;
        this.response = new ApiResponse(this._spec, this._opSpec, response);
    }

    matchedOperation() {
        return this._opSpec.matched;
    }
}

class ApiService {
    constructor(spec: OpenAPIObject) {
        const { info: service } = spec;

        this.name = service.title;
        this.logoUrl = service['x-logo']?.url
        this.description = fromMarkdown(service.description);
        this.docsUrl = get(spec, 'externalDocs', 'url');
    }

    public readonly name: string;
    public readonly logoUrl?: string;
    public readonly description?: Html;
    public readonly docsUrl?: string;
}

function matchOperation(api: ApiMetadata, request: HtkRequest) {
    const matchingPath = getPath(api, request);

    const { pathSpec, path } = matchingPath || {
        pathSpec: empty(), path: getDummyPath(api, request)
    }

    const method = (
        lastHeader(request.headers['x-http-method-override']) || request.method
    ).toLowerCase();

    let operation: OperationObject | undefined = get(pathSpec, method);
    if (!operation && method === 'head') operation = get(pathSpec, 'get');

    return {
        method,
        path,
        pathSpec,
        spec: operation || empty(),
        matched: operation !== undefined
    };
}

type MatchedOperation = ReturnType<typeof matchOperation>;

class ApiOperation {
    constructor(
        op: MatchedOperation
    ) {
        this.name = stripTags(fromMarkdown(
            firstMatch<string>(
                [
                    () => (get(op.spec, 'summary', 'length') || Infinity) < 40, op.spec.summary!
                ],
                get(op.spec, 'operationId'),
                [
                    () => (get(op.spec, 'description', 'length') || Infinity) < 40, op.spec.description!
                ],
                op.pathSpec.summary
            ) || `${op.method.toUpperCase()} ${op.path}`
        ).__html);

        this.description = fromMarkdown(firstMatch<string>(
            [() => get(op.spec, 'description') !== this.name, get(op.spec, 'description')],
            [() => get(op.spec, 'summary') !== this.name, get(op.spec, 'summary')],
            op.pathSpec.description
        ));

        if (!op.matched) this.warnings.push(
            `Unknown operation '${this.name}'.`
        );

        if (op.spec.deprecated) this.warnings.push(
            `The '${this.name}' operation is deprecated.`
        );

        this.docsUrl = get(op.spec, 'externalDocs', 'url');

        this.warnings = this.warnings.map(e => stripTags(e));
    }

    name: string;
    description?: Html;
    docsUrl?: string;

    warnings: string[] = [];
}

class ApiRequest {
    constructor(
        spec: OpenAPIObject,
        op: MatchedOperation,
        request: HtkRequest
    ) {
        this.parameters = getParameters(
            op.path,
            (op.pathSpec.parameters || []).concat(op.spec.parameters || []),
            request
        );

        this.bodySchema = getBodySchema(
            spec,
            op.spec.requestBody as RequestBodyObject | undefined,
            request
        );
    }

    parameters: Parameter[];
    bodySchema?: SchemaObject;
}

export interface Parameter {
    name: string;
    description?: Html;
    value?: unknown;
    defaultValue?: unknown;
    enum?: unknown[];
    type?: string;
    in: ParameterLocation;
    required: boolean;
    deprecated: boolean;
    warnings: string[];
}

class ApiResponse {
    constructor(
        spec: OpenAPIObject,
        op: MatchedOperation,
        response: HtkResponse
    ) {
        const bodySpec: RequestBodyObject | undefined = op.spec.responses
            ? (
                op.spec.responses[response.statusCode.toString()] ||
                op.spec.responses.default
            )
            : undefined;

        this.description = bodySpec && bodySpec.description !== response.statusMessage
            ? fromMarkdown(bodySpec.description)
            : undefined;
        this.bodySchema = getBodySchema(spec, bodySpec, response);
    }

    description?: Html;
    bodySchema?: SchemaObject;
}