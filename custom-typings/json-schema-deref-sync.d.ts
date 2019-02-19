declare module 'json-schema-deref-sync' {
    function deref<T>(input: T, options?: {}): T;
    export = deref;
}