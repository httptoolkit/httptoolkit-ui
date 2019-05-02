declare module 'har-validator' {
    import * as HarFormat from 'har-format';

    export function har(data: unknown): Promise<HarFormat.Har>;
}