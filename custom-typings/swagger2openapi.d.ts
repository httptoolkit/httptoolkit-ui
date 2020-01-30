declare module 'swagger2openapi' {
    import { OpenAPIObject } from "openapi-directory";

    interface ConvertOptions {
        resolve?: boolean;
        patch?: boolean;
    }

    export function convertObj(
        swagger: object,
        options: ConvertOptions,
        callback: (err: Error | null, result: {
            warnings?: string[]
            openapi: OpenAPIObject
        }) => void
    ): void;
}