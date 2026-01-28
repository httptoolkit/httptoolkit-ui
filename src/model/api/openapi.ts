import * as _ from 'lodash';
import { get } from 'typesafe-get';
import { action, observable } from 'mobx';

import type {
    OpenAPIObject,
    PathObject,
    OperationObject,
    ParameterObject,
    ResponseObject,
    RequestBodyObject,
    SchemaObject
} from 'openapi-directory';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import {
    HttpExchangeView,
    ExchangeMessage,
    HtkRequest,
    HtkResponse,
    Html
} from "../../types";
import { firstMatch, empty } from '../../util';
import { getHeaderValue } from '../http/headers';
import { formatAjvError } from '../../util/json-schema';

import {
    ApiExchange,
    ApiService,
    ApiOperation,
    ApiRequest,
    ApiResponse,
    ApiParameter
} from './api-interfaces';
import { OpenApiMetadata } from './build-api-metadata';
import { fromMarkdown } from '../ui/markdown';

const paramValidator = new Ajv({
    coerceTypes: 'array',
    strict: false,
    strictSchema: false,
    formats: new Proxy({}, {
        // Return 'true' (ignore) for all undefined formats:
        get(target: any, name: string) {
            if (name in target) return target[name];
            else return true;
        }
    })
});
addFormats(paramValidator);

function getPath(api: OpenApiMetadata, request: HtkRequest): {
    pathSpec: PathObject,
    path: string
} | undefined {
    const { parsedUrl } = request;

    // Request URL without query params
    const url = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;

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
): ApiParameter[] {
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
                description: fromMarkdown(param.description, { linkify: true }),
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
                            formatAjvError(valueWrapper, e, (path) => path.replace(/^\/value/, param.name))
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

    const contentType = getHeaderValue(message.headers, 'content-type') || '*/*';

    const schemasByType = bodyDefinition.content;
    if (!schemasByType) return {};

    // Sort the keys by the number of *'s present
    const mediaTypeKeys = _.sortBy(Object.keys(schemasByType),
        (key) => _.sumBy(key, (c: string) => c === '*' ? 1 : 0)
    );

    const schemaKey = _.find<string>(mediaTypeKeys, (key) =>
        new RegExp('^' + // Must match at the start
            key.replace(/\*/g, '.*') // Wildcards to regex wildcard
                .replace(/;.*/g, '') // Ignore charset etc
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

function getDummyPath(api: OpenApiMetadata, request: HtkRequest): string {
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

export class OpenApiExchange implements ApiExchange {
    constructor(api: OpenApiMetadata, exchange: HttpExchangeView) {
        const { request } = exchange;
        this.service = new OpenApiService(api.spec);

        this._spec = api.spec;
        this._opSpec = matchOpenApiOperation(api, request);

        this.operation = new OpenApiOperation(this._opSpec);
        this.request = new OpenApiRequest(api.spec, this._opSpec, request);

        if (exchange.response) {
            this.updateWithResponse(exchange.response);
        }
    }

    private _spec: OpenAPIObject;
    private _opSpec: MatchedOperation;

    public readonly service: ApiService;
    public readonly operation: ApiOperation;
    public readonly request: ApiRequest;

    @observable.ref
    public response: ApiResponse | undefined;

    @action
    updateWithResponse(response: HtkResponse | 'aborted' | undefined): void {
        if (response === 'aborted' || response === undefined) return;
        this.response = new OpenApiResponse(this._spec, this._opSpec, response);
    }

    matchedOperation() {
        return this._opSpec.matched;
    }
}

class OpenApiService implements ApiService {
    constructor(spec: OpenAPIObject) {
        const { info: service } = spec;

        this.name = service.title;
        this.shortName = service['x-httptoolkit-short-name']
            ?? this.name.split(' ')[0];

        this.logoUrl = service['x-logo']?.url;
        this.description = fromMarkdown(service.description, { linkify: true });
        this.docsUrl = spec?.externalDocs?.url;
    }

    public readonly shortName: string;
    public readonly name: string;
    public readonly logoUrl?: string;
    public readonly description?: Html;
    public readonly docsUrl?: string;
}

export function matchOpenApiOperation(api: OpenApiMetadata, request: HtkRequest) {
    const matchingPath = getPath(api, request);

    const { pathSpec, path } = matchingPath || {
        pathSpec: empty(), path: getDummyPath(api, request)
    }

    const method = (
        getHeaderValue(request.headers, 'x-http-method-override') || request.method
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

type MatchedOperation = ReturnType<typeof matchOpenApiOperation>;

class OpenApiOperation implements ApiOperation {
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
            ) || `${op.method.toUpperCase()} ${op.path}`,
            { linkify: true }
        ).__html);

        this.description = fromMarkdown(firstMatch<string>(
            [() => get(op.spec, 'description') !== this.name, get(op.spec, 'description')],
            [() => get(op.spec, 'summary') !== this.name, get(op.spec, 'summary')],
            op.pathSpec.description
        ), { linkify: true });

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

class OpenApiRequest implements ApiRequest {
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

    parameters: ApiParameter[];
    bodySchema?: SchemaObject;
}

class OpenApiResponse implements ApiResponse {
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

        this.description = bodySpec?.description &&
            bodySpec.description !== response.statusMessage && // Ignore description "Not Found" and similar
            bodySpec.description.split(' ').filter(Boolean).length! > 2 // Ignore pointlessly short (Response/Error Response) descriptions
                ? fromMarkdown(bodySpec.description, { linkify: true })
                : undefined;
        this.bodySchema = getBodySchema(spec, bodySpec, response);
    }

    description?: Html;
    bodySchema?: SchemaObject;
}