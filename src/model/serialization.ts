import * as serializr from 'serializr';
import { recursiveMapValues } from '../util';
import { asBuffer } from '../util/buffer';

export const serializeAsTag = (getTag: (value: any) => any) =>
    serializr.custom(
        getTag,
        () => serializr.SKIP
    );

export const serializeRegex = serializr.custom(
    (value: RegExp) => ({ source: value.source, flags: value.flags }),
    (value: { source: string, flags: string }) => new RegExp(value.source, value.flags)
);

export const serializeBuffer = serializr.custom(
    (buffer: string | Buffer | Uint8Array | undefined): string | undefined => buffer !== undefined
        ? asBuffer(buffer).toString('base64')
        : undefined,
    (data: string | undefined): Buffer | undefined => data !== undefined
        ? Buffer.from(data, 'base64')
        : undefined
);

const undefinedPlaceholder = "__http_toolkit_undefined_placeholder__";
export const serializeWithUndefineds = serializr.custom(
    (value: {}): string | undefined => value
        ? JSON.stringify(value, (k, v) =>
            v === undefined ? undefinedPlaceholder : v
        )
        : undefined,
    (data: string): unknown => !!data
        ? recursiveMapValues(
            JSON.parse(data),
            (v) => v === undefinedPlaceholder ? undefined : v // Can't do this in parse - it drops undef values
        )
        : undefined
);

// Bit of a hack to let us call propSchema.deserializer easily in sync code,
// without having to fight to collate values from callbacks. Only works for
// propSchemas that call the callback synchronously.
function syncDeserialize(
    propSchema: serializr.PropSchema,
    value: any,
    context: any
) {
    let result: any;
    let error: any;

    propSchema.deserializer(value, (err, data) => {
        if (err) error = err;
        else result = data;
    }, context, undefined);

    // Requires that the callback was already called!
    if (error) {
        throw error;
    } else {
        return result;
    }
}

export const serializeMap = (keySchema: serializr.PropSchema, valueSchema: serializr.PropSchema) =>
    serializr.custom(
        (map: Map<any, any>) => Array.from(map.entries()).map((entry) =>
            [
                keySchema.serializer(entry[0]),
                valueSchema.serializer(entry[1])
            ]
        ),
        (
            mapAsArray: any[],
            context: any,
            _oldValue: any,
            callback: (err: any, result: any) => void
        ) => callback(null,
            new Map(
                mapAsArray.map((entry) => [
                    syncDeserialize(keySchema, entry[0], context),
                    syncDeserialize(valueSchema, entry[1], context),
                ]
            )
        ))
    )

export const hasSerializrSchema = (obj: any) => !!serializr.getDefaultModelSchema(obj);

export const rawSchema = serializr.createSimpleSchema({ "*": true });