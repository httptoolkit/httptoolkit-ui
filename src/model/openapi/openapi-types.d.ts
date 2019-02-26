import {
    OpenAPIObject,
    PathItemObject,
    ParameterLocation,
    SchemaObject
} from "openapi-directory";

import { Html } from "../../types";

export interface ApiMetadata {
    spec: OpenAPIObject;
    serverMatcher: RegExp;
    pathMatchers: Map<
        RegExp,
        { pathData: PathItemObject, path: string }
    >;
}

export interface Parameter {
    name: string;
    description?: Html;
    value?: unknown;
    defaultValue?: unknown;
    in: ParameterLocation;
    required: boolean;
    deprecated: boolean;
    validationErrors: string[];
}

export interface ApiExchange {
    serviceTitle: string;
    serviceLogoUrl?: string;
    serviceDescription?: Html;
    serviceDocsUrl?: string;

    operationName: string;
    operationDescription?: Html;
    operationDocsUrl?: string;

    parameters: Parameter[];
    requestBody?: SchemaObject;

    responseDescription?: Html;
    responseBody?: SchemaObject;

    validationErrors: string[];
}