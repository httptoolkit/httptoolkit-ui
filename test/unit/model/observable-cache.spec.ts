import * as sinon from 'sinon';
import { autorun, computed, configure, runInAction } from 'mobx';
import { fromPromise } from 'mobx-utils';

import { expect } from '../../test-setup';

import { ObservableCache } from '../../../src/model/observable-cache';

// logError calls `console.log('Reporting error:', ...)` unconditionally as its
// first line, so we hook console.log and pick out those entries. (Hooking
// logError directly is hard).
function captureLoggedErrors(): { getMessages: () => string[], restore: () => void } {
    const messages: string[] = [];
    const stub = sinon.stub(console, 'log').callsFake((...args: any[]) => {
        if (args[0] === 'Reporting error:') {
            const second = args[1];
            messages.push(typeof second === 'string' ? second : String(second));
        }
    });
    return {
        getMessages: () => messages,
        restore: () => stub.restore()
    };
}

describe('ObservableCache', () => {

    let logged: ReturnType<typeof captureLoggedErrors>;

    beforeEach(() => { logged = captureLoggedErrors(); });
    afterEach(() => { logged.restore(); });

    describe('basic semantics', () => {

        it('returns undefined / false for missing keys', () => {
            const cache = new ObservableCache();
            const key = Symbol('k');

            expect(cache.has(key)).to.equal(false);
            expect(cache.get(key)).to.equal(undefined);
        });

        it('stores and returns values for symbol keys', () => {
            const cache = new ObservableCache();
            const key = Symbol('k');

            cache.set(key, 'value');

            expect(cache.has(key)).to.equal(true);
            expect(cache.get(key)).to.equal('value');
        });

        it('keeps distinct keys independent', () => {
            const cache = new ObservableCache();
            const a = Symbol('a');
            const b = Symbol('b');

            cache.set(a, 1);
            cache.set(b, 2);

            expect(cache.get(a)).to.equal(1);
            expect(cache.get(b)).to.equal(2);
        });

        it('treats two same-description symbols as distinct keys', () => {
            const cache = new ObservableCache();
            const a = Symbol('json');
            const b = Symbol('json');

            cache.set(a, 'first');

            expect(cache.has(a)).to.equal(true);
            expect(cache.has(b)).to.equal(false);
        });

    });

    describe('overwrite protection', () => {

        it('logs an error if set() is called with an existing key', () => {
            const cache = new ObservableCache();
            const key = Symbol('k');

            cache.set(key, 1);
            cache.set(key, 2);

            const messages = logged.getMessages();
            expect(messages).to.have.length(1);
            expect(messages[0]).to.match(/already-set key/);
        });

        it('preserves the original value when an overwrite is rejected', () => {
            const cache = new ObservableCache();
            const key = Symbol('k');

            cache.set(key, 'first');
            cache.set(key, 'second');

            expect(cache.get(key)).to.equal('first');
        });

    });

    describe('clear() semantics', () => {

        it('logs an error on access after clear, but does not throw', () => {
            const cache = new ObservableCache();
            const key = Symbol('k');
            cache.set(key, 1);

            cache.clear();

            expect(() => cache.has(key)).to.not.throw();
            expect(() => cache.get(key)).to.not.throw();
            expect(() => cache.set(key, 2)).to.not.throw();
            // Reports only the first post-clear access (the cache could otherwise
            // spam Sentry while a leaked observer flails on its way to disposal).
            const messages = logged.getMessages();
            expect(messages).to.have.length(1);
            expect(messages[0]).to.match(/after clear\(\)/);
        });

        it('returns empty for has() / get() after clear', () => {
            const cache = new ObservableCache();
            const key = Symbol('k');
            cache.set(key, 1);

            cache.clear();

            expect(cache.has(key)).to.equal(false);
            expect(cache.get(key)).to.equal(undefined);
        });

        it('does not re-populate the cache when set() runs after clear', () => {
            // Re-populating would defeat the memory-release intent of clear() and
            // (worse) could reproduce the original infinite-loop scenario.
            const cache = new ObservableCache();
            const key = Symbol('k');
            cache.clear();

            cache.set(key, 'should-be-skipped');

            expect(cache.has(key)).to.equal(false);
            expect(cache.get(key)).to.equal(undefined);
        });

        it('is idempotent: clear() on an already-cleared cache does not throw, just logs', () => {
            const cache = new ObservableCache();
            cache.set(Symbol('k'), 1);

            cache.clear();
            cache.clear();

            const messages = logged.getMessages();
            expect(messages).to.have.length(1);
            expect(messages[0]).to.match(/Duplicate call to ObservableCache.clear\(\)/);
        });

        it('does NOT wake observers when cleared', () => {
            // Pinging atoms on clear would re-evaluate any observer that touched
            // the cache - and observers following the cache-or-format pattern
            // would issue brand new format requests during teardown that nobody
            // is waiting for. Observers don't self-dispose on notification, so
            // waking them buys us nothing useful. Leaked observers surface later,
            // via whatever else triggers them.
            const cache = new ObservableCache();
            const key = Symbol('k');
            cache.set(key, 1);

            let runCount = 0;
            const dispose = autorun(() => { runCount++; void cache.has(key); });
            expect(runCount).to.equal(1);

            cache.clear();
            expect(runCount).to.equal(1); // not re-run

            dispose();
        });

    });

    describe('MobX reactivity', () => {

        it('makes has() reactive to set()', () => {
            const cache = new ObservableCache();
            const key = Symbol('k');
            let observed: boolean | undefined;

            const dispose = autorun(() => { observed = cache.has(key); });
            expect(observed).to.equal(false);

            cache.set(key, 'v');
            expect(observed).to.equal(true);
            dispose();
        });

        it('makes get() reactive to set()', () => {
            const cache = new ObservableCache();
            const key = Symbol('k');
            let observed: unknown = 'unset';

            const dispose = autorun(() => { observed = cache.get(key); });
            expect(observed).to.equal(undefined);

            cache.set(key, 'v');
            expect(observed).to.equal('v');
            dispose();
        });

        it('does not cross-fire between distinct keys', () => {
            const cache = new ObservableCache();
            const a = Symbol('a');
            const b = Symbol('b');
            let aRuns = 0;
            let bRuns = 0;

            const da = autorun(() => { void cache.has(a); aRuns++; });
            const db = autorun(() => { void cache.has(b); bRuns++; });

            expect(aRuns).to.equal(1);
            expect(bRuns).to.equal(1);

            cache.set(a, 1);
            expect(aRuns).to.equal(2);
            expect(bRuns).to.equal(1);

            cache.set(b, 1);
            expect(aRuns).to.equal(2);
            expect(bRuns).to.equal(2);

            da(); db();
        });

        it('works as a dep inside computed values', () => {
            const cache = new ObservableCache();
            const key = Symbol('k');
            const c = computed(() => cache.has(key) ? cache.get(key) : 'absent');

            let value: unknown;
            const dispose = autorun(() => { value = c.get(); });
            expect(value).to.equal('absent');

            cache.set(key, 'present');
            expect(value).to.equal('present');
            dispose();
        });

    });

    describe('use from inside a @computed', () => {

        // The previous observable.object-backed cache crashed when cache.set was
        // called from inside a @computed whose prior evaluation had already bound
        // the key's pendingKeys entry as an observed dep. The throw left the cache
        // half-initialised (values populated, pendingKeys not), causing an infinite
        // re-format loop in the calling component. With atoms, this is safe.

        it('allows write from inside a computed without throwing', () => {
            const cache = new ObservableCache();
            const key = Symbol('k');
            let formatCalls = 0;

            const c = computed(() => {
                if (!cache.has(key)) {
                    formatCalls++;
                    cache.set(key, `value-${formatCalls}`);
                }
                return cache.get(key);
            });

            const dispose = autorun(() => { void c.get(); });

            expect(formatCalls).to.equal(1);
            expect(cache.has(key)).to.equal(true);
            expect(cache.get(key)).to.equal('value-1');
            dispose();
        });

        it('does not loop when many computeds share a cache (the original bug)', async () => {
            // Reproduces the exact pattern that previously hard-looped the UI worker:
            // multiple observers of cache.has(k), each writing from inside a @computed.
            // The previous observable.object-backed cache crashed half-way through
            // addObservableProp and left the cache in a state where get returned the
            // promise but has returned false, sending the viewers into a re-format loop.
            const cache = new ObservableCache();
            const key = Symbol('json');
            let formatCalls = 0;

            const makeViewer = () => {
                const view = computed(() => {
                    if (cache.has(key)) {
                        const v: any = cache.get(key);
                        if (v.state === 'fulfilled') return v.value;
                        return v;
                    }
                    formatCalls++;
                    const id = formatCalls;
                    const p = fromPromise(new Promise(r => setTimeout(() => r(`fmt-${id}`), 1)));
                    cache.set(key, p);
                    return p;
                });
                return autorun(() => { void view.get(); });
            };

            const disposers: Array<() => void> = [];
            for (let i = 0; i < 5; i++) disposers.push(makeViewer());
            await new Promise(r => setTimeout(r, 30));

            // Exactly one format ran across all five viewers - they all share the
            // cached result. Without the fix, each viewer would have triggered its
            // own format on the post-write re-evaluation, in an unbounded loop.
            expect(formatCalls).to.equal(1);
            disposers.forEach(d => d());
        });

    });

    describe('lazy initialisation', () => {

        it('does not allocate internal storage for a cache that is never used', () => {
            // We can't directly observe internal allocation, but we can at least
            // check that constructing many empty caches and immediately clearing
            // them doesn't throw or misbehave. (This used to matter for memory:
            // the project holds tens of thousands of these.)
            const caches: ObservableCache[] = [];
            for (let i = 0; i < 1000; i++) caches.push(new ObservableCache());
            for (const c of caches) expect(() => c.clear()).to.not.throw();
        });

    });

});
