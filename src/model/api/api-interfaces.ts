import type * as querystring from 'querystring';
import type {
    SchemaObject
} from 'openapi-directory';

import type {
    HtkResponse,
    Html
} from "../../types";
import { OpenApiMetadata } from './build-openapi';

export type ApiMetadata =
    | OpenApiMetadata;

export interface ApiRequestMatcher {
    pathMatcher: RegExp;
    queryMatcher: querystring.ParsedUrlQuery;
}

export interface ApiExchange {
    readonly service: ApiService;
    readonly operation: ApiOperation;
    readonly request: ApiRequest;

    readonly response: ApiResponse | undefined;

    updateWithResponse(response: HtkResponse | 'aborted' | undefined): void;

    matchedOperation(): boolean;
}

export interface ApiService {
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
        | 'query';
    required: boolean;
    deprecated: boolean;
    warnings: string[];
}

export interface ApiResponse {
    description?: Html;
    bodySchema?: SchemaObject;
}