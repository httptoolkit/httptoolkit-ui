import { observable } from 'mobx';

/**
 * An observable symbol-only cache, for storing calculated data
 * that is expensive to compute, and linking it to individual
 * messages (meaning messages can also actively clean it up).
 */
export class ObservableCache<T extends {
    [key: symbol]: unknown
} = {
    [key: symbol]: unknown
}> {

    // Due to the per-message per-exchange overhead of this, we avoid actually
    // instantiating each cache until somebody tries to use it.
    #lazyInstData: T | undefined = undefined;

    get #data(): T {
        if (this.#lazyInstData === undefined) {
            this.#lazyInstData = observable.object<{
                [key: symbol]: any
            }>({}, {}, { deep: false }) as any as T;
        }
        return this.#lazyInstData;
    }

    has<K extends keyof T>(key: K): boolean {
        return key in this.#data;
    }

    get<K extends keyof T>(key: K): T[K] | undefined {
        return this.#data[key] as T[K] | undefined;
    }

    set<K extends keyof T>(key: K, value: T[K]): void {
        this.#data[key] = value;
    }

    clear(): void {
        for (let key of Object.getOwnPropertySymbols(this.#data)) {
            delete this.#data[key];
        }
    }

}