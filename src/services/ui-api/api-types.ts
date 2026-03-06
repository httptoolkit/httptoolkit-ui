import { JSONSchema7 } from 'json-schema';

export interface OperationDefinition {
    name: string;
    description: string;
    inputSchema: JSONSchema7;
    outputSchema: JSONSchema7;
    category: string;
    annotations?: {
        readOnlyHint?: boolean;
        destructiveHint?: boolean;
        idempotentHint?: boolean;
        openWorldHint?: boolean;
    };
}

export interface OperationResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: { code: string; message: string };
}

export type OperationHandler = (
    params: Record<string, unknown>
) => Promise<OperationResult>;

export interface Operation {
    definition: OperationDefinition;
    handler: OperationHandler;
}
