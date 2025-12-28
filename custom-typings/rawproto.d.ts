declare module 'rawproto' {
    /**
     * RawProto class for parsing raw protobuf binary data without a schema.
     * Migrated from deprecated rawprotoparse package.
     */
    export class RawProto {
        constructor(data: Uint8Array | ArrayBuffer | Buffer | number[]);

        /**
         * Convert the parsed protobuf data to a JavaScript object.
         * @param queryMap - Optional query map for field name/type mapping
         * @param prefix - Field name prefix (default: 'f')
         * @param nameMap - Optional name map
         * @param typeMap - Optional type map
         */
        toJS(
            queryMap?: Record<string, string>,
            prefix?: string,
            nameMap?: Record<string, string>,
            typeMap?: Record<string, string>
        ): Record<string, any>;

        /**
         * Generate a .proto schema file from the parsed data.
         */
        toProto(
            queryMap?: Record<string, string>,
            prefix?: string,
            nameMap?: Record<string, string>,
            typeMap?: Record<string, string>,
            messageName?: string
        ): string;

        /**
         * Query specific fields using path:type format.
         */
        query(...queries: string[]): any[];

        /**
         * Sub-messages indexed by field number.
         */
        sub: Record<string, RawProto[]>;

        /**
         * Field counts.
         */
        fields: Record<number, number>;

        /**
         * The value as a string, if it looks like a string.
         */
        string?: string;

        /**
         * The value as an integer.
         */
        int?: number;

        /**
         * The value as a float.
         */
        float?: number;

        /**
         * The value as a boolean.
         */
        bool?: boolean;

        /**
         * The raw bytes.
         */
        bytes?: Buffer;

        /**
         * Whether the value is likely a string.
         */
        likelyString?: boolean;
    }

    export default RawProto;
}
