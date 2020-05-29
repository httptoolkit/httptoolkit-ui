// Based on mobx-persist: https://github.com/pinqy520/mobx-persist
// Sadly now unmaintained.

import * as _ from 'lodash';
import {
    reaction,
    runInAction
} from 'mobx';
import {
    serialize,
    update,
    serializable,
    getDefaultModelSchema
} from 'serializr';
import * as Storage from './storage';
import { types, Types } from './types';
import { persistObject } from './persist-object';

// @persist decorator:
export function persist(type: Types, schema?: any): (target: Object, key: string, baseDescriptor?: PropertyDescriptor) => void // two
export function persist(target: Object, key: string, baseDescriptor?: PropertyDescriptor): void // method decorator
export function persist(schema: Object): <T>(target: T) => T // object
export function persist(...args: any[]): any {
    const [a, b] = args
    if (a in types) {
        return serializable(types[a](b));
    } else if (args.length === 1) {
        return (target: any) => persistObject(target, a);
    } else {
        return serializable.apply(null, args as any);
    }
}

// Rehydration function:
export async function hydrate<T extends Object>(options: {
    key: string,
    store: T,
    storage?: typeof Storage,
    jsonify?: boolean,
    dataTransform?: (data: any) => any,
    customArgs?: any
}): Promise<void> {
    const { key, store, storage, jsonify, dataTransform, customArgs } = _.defaults(options, {
        customArgs: {},
        storage: Storage,
        jsonify: true,
        dataTransform: _.identity
    });

    const schema = getDefaultModelSchema(store as any);

    // Load existing data, if available, and apply it to the store
    const rawData = await storage.getItem(key);
    if (rawData) {
        const data = jsonify ? JSON.parse(rawData) : rawData;

        if (data && typeof data === 'object') {
            runInAction(() => {
                update(schema, store, dataTransform(data), undefined, customArgs);
            });
        }
    }

    // Whenever the serialized result changes, store it:
    reaction(
        () => serialize(schema, store),
        (data: any) => storage.setItem(
            key,
            jsonify ? JSON.stringify(data) : data
        )
    );
}

