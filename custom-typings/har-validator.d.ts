declare module 'har-validator' {
    import * as HarFormat from 'har-format';
    import * as Ajv from 'ajv';

    export type HarParseError = Ajv.ValidationError;

    export function har(data: unknown): Promise<HarFormat.Har>;
}