import type {
    OpenAPIObject,
    SchemaObject
} from 'openapi-directory';

import type {
    HtkResponse,
    Html
} from "../../types";

import type { OpenApiMetadata } from './build-api-metadata';
import type { OpenRpcDocument, OpenRpcMetadata } from './jsonrpc';

export type ApiMetadata =
    | OpenApiMetadata
    | OpenRpcMetadata;

export type ApiSpec =
    | OpenAPIObject
    | OpenRpcDocument;

export interface ApiExchange {

    /**
     * Built-in API specs are special: they're shown for free users too, and they're
     * shown differently in the list (highlighting the operation, not the normal
     * lower-level HTTP details).
     */
    readonly isBuiltInApi: boolean;

    readonly service: ApiService;
    readonly operation: ApiOperation;
    readonly request: ApiRequest;

    readonly response: ApiResponse | undefined;

    updateWithResponse(response: HtkResponse | 'aborted' | undefined): void;

    matchedOperation(): boolean;
}

export interface ApiService {
    readonly shortName: string;
    readonly name: string;
    readonly logoUrl?: string;
    readonly description?: Html;
    readonly docsUrl?: string;
}

export interface ApiOperation {
    readonly name: string;
    readonly description?: Html;
    readonly docsUrl?: string;

    readonly warnings: string[];
}

export interface ApiRequest {
    parameters: ApiParameter[];
    bodySchema?: SchemaObject;
}

export interface ApiParameter {
    name: string;
    description?: Html;
    value?: unknown;
    defaultValue?: unknown;
    enum?: unknown[];
    type?: string;
    in:
        | 'cookie'
        | 'path'
        | 'header'
        | 'query'
        | 'body';
    required: boolean;
    deprecated: boolean;
    warnings: string[];
}

export interface ApiResponse {
    description?: Html;
    bodySchema?: SchemaObject;
}