import { createAtom, IAtom } from 'mobx';

import { logError } from '../errors';

/**
 * An observable symbol-only cache, for storing calculated data that is expensive
 * to compute, and linking it to individual messages (which can also actively clean
 * it up when the message goes away).
 *
 * This is backed by atoms rather than a simple observable.object to avoid issues
 * writes within computeds and similar - strongly discouraged by mobx, but clearly
 * useful in a caching scenario as long as it's done safely. We log any obvious
 * breaks of the invariants (multiple writes to the same key, usage after clear())
 * to Sentry so we can catch any issues with this.
 *
 * In future, these should probably throw directly, but let's confirm we don't have
 * notable existing issues first.
 */
export class ObservableCache<T extends {
    [key: symbol]: unknown
} = {
    [key: symbol]: unknown
}> {

    #data: Map<keyof T, unknown> | undefined = undefined;
    #atoms: Map<keyof T, IAtom> | undefined = undefined;
    #cleared = false;
    #postClearAccessReported = false;

    #atomFor(key: keyof T): IAtom {
        // Lazy-allocate both maps, to keep the per-cache overhead near zero for
        // the many caches that are created but never actually read or written.
        if (!this.#atoms) this.#atoms = new Map();
        let atom = this.#atoms.get(key);
        if (!atom) {
            atom = createAtom(`ObservableCache.${key.toString()}`);
            this.#atoms.set(key, atom);
        }
        return atom;
    }

    #reportIfCleared<K extends keyof T>(method: string, key: K): void {
        if (!this.#cleared) return;

        // Report just once, to keep logs manageable
        if (this.#postClearAccessReported) return;
        this.#postClearAccessReported = true;

        logError(`ObservableCache.${method} called after clear()`, {
            key: key.toString()
        });
    }

    has<K extends keyof T>(key: K): boolean {
        this.#reportIfCleared('has', key);
        this.#atomFor(key).reportObserved();

        return !!this.#data?.has(key);
    }

    get<K extends keyof T>(key: K): T[K] | undefined {
        this.#reportIfCleared('get', key);
        this.#atomFor(key).reportObserved();

        return this.#data && this.#data.get(key) as T[K] | undefined;
    }

    set<K extends keyof T>(key: K, value: T[K]): void {
        if (this.#cleared) {
            // This should never be called after clear (after exchange cleanup)
            // so we report and ignore
            this.#reportIfCleared('set', key);
            return;
        }
        if (this.#data?.has(key)) {
            logError(`ObservableCache.set called with an already-set key`, {
                key: key.toString()
            });

            // This should never be called multiple times (each key is caching
            // one result really - not intended to be observable over time) so
            // we ignore & report duplicate writes
            return;
        }

        if (!this.#data) this.#data = new Map();
        this.#data.set(key, value);
        this.#atomFor(key).reportChanged();
    }

    clear(): void {
        if (this.#cleared) {
            logError(`Duplicate call to ObservableCache.clear()`);
            return;
        }
        this.#cleared = true;
        this.#data = undefined;
        this.#atoms = undefined;
    }

}
