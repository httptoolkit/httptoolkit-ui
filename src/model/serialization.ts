import * as serializr from 'serializr';

export const serializeAsTag = (getTag: (value: any) => any) =>
serializr.custom(
    getTag,
    () => serializr.SKIP
);

export const hasSerializrSchema = (obj: any) => !!serializr.getDefaultModelSchema(obj);