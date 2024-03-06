declare module 'rawprotoparse' {
    function parseRawProto(
        data: Uint8Array,
        prefix?: string,
        stringMode?: 'auto' | 'string' | 'buffer',
        arrayMode?: boolean
    ): any;

    export = parseRawProto;
}