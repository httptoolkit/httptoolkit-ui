/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import {
    ContentDescriptorObject,
    JSONSchemaObject,
    MethodObject,
    OpenrpcDocument
} from "@open-rpc/meta-schema";
import { SchemaObject } from "openapi-directory";
import { HtkResponse, Html, HttpExchangeView } from "../../types";
import { ErrorLike, isErrorLike } from "../../util/error";
import { fromMarkdown } from "../ui/markdown";
import {
    ApiExchange,
    ApiOperation,
    ApiParameter,
    ApiRequest,
    ApiResponse,
    ApiService
} from "./api-interfaces";

export type OpenRpcDocument = OpenrpcDocument;

export interface OpenRpcMetadata {
    type: 'openrpc';
    spec: OpenRpcDocument;
    isBuiltInApi: boolean;
    serverMatcher: RegExp;
    requestMatchers: { [methodName: string] : MethodObject }; // JSON-RPC method name to method
}

export async function parseRpcApiExchange(
    api: OpenRpcMetadata,
    exchange: HttpExchangeView
): Promise<JsonRpcApiExchange> {
    try {
        const body = await exchange.request.body.waitForDecoding();

        if (!body?.length) throw new Error(`No JSON-RPC request body`);

        let parsedBody: any;
        let methodName: string;
        try {
            parsedBody = JSON.parse(body?.toString());
            if (parsedBody.jsonrpc !== '2.0') throw new Error(
                `JSON-RPC request body had bad 'jsonrpc' field: ${parsedBody.jsonrpc}`
            );

            methodName = parsedBody.method;
        } catch (e) {
            console.warn(e);
            throw new Error('Could not parse JSON-RPC request body');
        }

        const methodSpec = api.requestMatchers[methodName];
        if (!methodSpec) throw new Error(`Unrecognized JSON-RPC method name: ${methodName}`);

        const operation = {
            methodSpec,
            parsedBody
        };

        return new JsonRpcApiExchange(api, exchange, operation);
    } catch (error) {
        return new JsonRpcApiExchange(api, exchange, error as ErrorLike);
    }
}

interface MatchedOperation {
    methodSpec: MethodObject;
    parsedBody: any;
}

export class JsonRpcApiExchange implements ApiExchange {

    constructor(
        _api: OpenRpcMetadata,
        _exchange: HttpExchangeView,
        private _rpcMethod: MatchedOperation | ErrorLike
    ) {
        this.service = new JsonRpcApiService(_api);

        if (isErrorLike(_rpcMethod)) {
            this.operation = {
                name: 'Unrecognized request to JSON-RPC API',
                warnings: [_rpcMethod.message ?? _rpcMethod.toString()]
            };
            this.request = { parameters: [] };
        } else {
            this.operation = new JsonRpcApiOperation(
                _rpcMethod,
                _api.spec.externalDocs?.['x-method-base-url'] // Custom extension
            );
            this.request = new JsonRpcApiRequest(_rpcMethod);
        }
    }

    readonly service: ApiService;
    readonly operation: ApiOperation;
    readonly request: ApiRequest;
    response: ApiResponse | undefined;

    updateWithResponse(response: HtkResponse | "aborted" | undefined): void {
        if (
            response === 'aborted' ||
            response === undefined ||
            isErrorLike(this._rpcMethod)
        ) return;

        this.response = new JsonRpcApiResponse(this._rpcMethod);
    }

    matchedOperation(): boolean {
        return this._rpcMethod && !isErrorLike(this._rpcMethod);
    }

}

export class JsonRpcApiService implements ApiService {

    constructor(api: OpenRpcMetadata) {
        this.name = api.spec.info.title;
        this.shortName = api.spec.info['x-httptoolkit-short-name']
            ?? this.name.split(' ')[0];

        this.logoUrl = api.spec.info['x-logo']?.url;
        this.description = fromMarkdown(api.spec.info.description, { linkify: true });
        this.docsUrl = api.spec.externalDocs?.url;
    }

    readonly shortName: string;
    readonly name: string;
    readonly logoUrl?: string | undefined;
    readonly description?: Html | undefined;
    readonly docsUrl?: string | undefined;

}

export class JsonRpcApiOperation implements ApiOperation {

    constructor(
        rpcMethod: MatchedOperation,
        methodDocsBaseUrl: string | undefined
    ) {
        const { methodSpec } = rpcMethod;

        this.name = methodSpec.name;
        this.description = fromMarkdown([
            methodSpec.summary,
            methodSpec.description
        ].filter(x => !!x).join('\n\n'), { linkify: true });
        this.docsUrl = methodSpec.externalDocs?.url
            ?? (methodDocsBaseUrl
                ? methodDocsBaseUrl + methodSpec.name.toLowerCase()
                : undefined
            );

        if (methodSpec.deprecated) {
            this.warnings.push(`The '${this.name}' method is deprecated.`);
        }
    }

    name: string;
    description?: Html | undefined;
    docsUrl?: string | undefined;
    warnings: string[] = [];

}

const capitalizeFirst = (input: string | undefined) =>
    input
    ? input.charAt(0).toUpperCase() + input.slice(1)
    : undefined;

export class JsonRpcApiRequest implements ApiRequest {

    constructor(rpcMethod: MatchedOperation) {
        const { methodSpec, parsedBody } = rpcMethod;

        this.parameters = (methodSpec.params as ContentDescriptorObject[])
            .map((param: ContentDescriptorObject, i: number) => {
                const schema = param.schema as JSONSchemaObject | undefined;

                return {
                    name: param.name,
                    description: fromMarkdown([
                        param.summary,
                        param.description,
                        capitalizeFirst(schema?.title),
                        ...(schema?.oneOf?.length
                            ? [
                                'One of:',
                                (schema.oneOf as JSONSchemaObject[]).map(subschema =>
                                    `* ${capitalizeFirst(subschema.title)}: ${
                                        subschema.description || subschema.type || 'unknown'
                                    }`
                                ).join('\n')
                            ]
                            : []
                        )
                    ].filter(x => !!x).join('\n\n'), { linkify: true }),
                    in: 'body',
                    required: !!param.required,
                    deprecated: !!param.deprecated,
                    type: schema?.type,
                    value: parsedBody.params[i],
                    defaultValue: schema?.default,
                    enum: schema?.enum || (schema?.items as SchemaObject | undefined)?.enum,
                    warnings: [
                        ...(param.deprecated ? [`The '${param.name}' parameter is deprecated.`] : []),
                        ...(param.required &&
                            parsedBody.params[i] === undefined &&
                            (schema && schema.default === undefined)
                            ? [`The '${param.name}' parameter is required.`]
                            : []
                        )
                    ]
                };
            });
    }

    parameters: ApiParameter[];

}

export class JsonRpcApiResponse implements ApiResponse {

    constructor(rpcMethod: MatchedOperation) {
        const resultSpec = rpcMethod.methodSpec.result as ContentDescriptorObject;

        this.description = fromMarkdown(resultSpec.description, { linkify: true });
        this.bodySchema = {
            type: 'object',
            properties: {
                id: { type: 'number' },
                jsonrpc: { type: 'string', enum: ['2.0'] },
                result: resultSpec.schema as SchemaObject,
                error: {
                    type: 'object',
                    properties: {
                        code: { type: 'number' },
                        message: { type: 'string' }
                    }
                }
            },
            required: ['id', 'jsonrpc']
        };
    }

    description?: Html;
    bodySchema?: SchemaObject;

}
