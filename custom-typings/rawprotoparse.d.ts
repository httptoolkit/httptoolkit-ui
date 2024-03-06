declare module 'rawprotoparse' {
    function parseRawProto(
        data: Buffer,
        prefix?: string,
        stringMode?: 'auto' | 'string' | 'buffer',
        arrayMode?: boolean
    ): any;

    export = parseRawProto;
}