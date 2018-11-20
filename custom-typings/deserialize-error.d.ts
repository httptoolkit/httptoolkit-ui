declare module 'deserialize-error' {
    function deserializeError(obj: any): Error;
    export = deserializeError;
}