import * as sinon from 'sinon';
import { observable, reaction } from 'mobx';

import { expect } from '../../test-setup';
import { debounceComputed } from '../../../src/util/observable';

describe("Deferred observables", () => {

    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
    });

    afterEach(() => {
        clock.restore();
    });

    it("calls the computed immediately initially", () => {
        let counter = observable.box(0);
        const slowComputed = debounceComputed(() => counter.get() + 1, 100);
        expect(slowComputed.get()).to.equal(1);
    });

    it("doesn't rerun the computed for subsequent calls", () => {
        let counter = observable.box(0);

        const slowComputed = debounceComputed(() => counter.get() + 1, 100);
        expect(slowComputed.get()).to.equal(1);

        counter.set(5);
        expect(slowComputed.get()).to.equal(1);
    });

    it("does rerun the computed after a delay", () => {
        let counter = observable.box(0);

        const slowComputed = debounceComputed(() => counter.get() + 1, 100);
        expect(slowComputed.get()).to.equal(1);

        counter.set(5);
        expect(slowComputed.get()).to.equal(1);

        clock.tick(100);
        expect(slowComputed.get()).to.equal(6);
    });

    it("immediately updates subscribers of the first change", () => {
        let counter = observable.box(0);
        const slowComputed = debounceComputed(() => counter.get() + 1, 100);

        let seenUpdates = 0;
        reaction(() => slowComputed.get(), () => { seenUpdates += 1; });

        clock.tick(100);
        expect(seenUpdates).to.equal(0);
        counter.set(2);
        expect(seenUpdates).to.equal(1);
    });

    it("updates subscribers about subsequent pending changes after a delay", () => {
        let counter = observable.box(0);
        const slowComputed = debounceComputed(() => counter.get() + 1, 100);

        let seenUpdates = 0;
        reaction(() => slowComputed.get(), () => { seenUpdates += 1; });

        clock.tick(100);
        counter.set(2);
        expect(seenUpdates).to.equal(1);

        counter.set(3);
        counter.set(4);
        counter.set(5);
        expect(seenUpdates).to.equal(1); // No update yet

        clock.tick(100);
        expect(seenUpdates).to.equal(2); // Updates once, 100ms later
    });
});