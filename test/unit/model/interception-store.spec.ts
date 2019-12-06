import { InterceptionStore } from "../../../src/model/interception-store";
import { HtkMockRule, HtkMockRuleRoot } from "../../../src/model/rules/rules";

import { expect } from "../../test-setup";

const group = (id: number, ...items: Array<HtkMockRule>) => ({
    id: id.toString(),
    title: id.toString(),
    items
});

describe("Interception store", () => {
    describe("rules", () => {

        let store: InterceptionStore;
        let [a, b, c, d, e, f] = 'abcdef'
            .split('')
            .map((char) => ({ id: char }) as HtkMockRule);

        beforeEach(() => {
            store = new InterceptionStore(() => {});
            store.rules = { id: 'root', items: [] } as any as HtkMockRuleRoot;
            store.draftRules = { id: 'root', items: [] } as any as HtkMockRuleRoot;
        });

        describe("should update all positions for a single save, if the saved rule has moved", () => {
            it("abc -> bca", () => {
                store.rules.items = [a, b, c];
                store.draftRules.items = [b, c, a];

                store.saveRule([1]);
                expect(store.rules.items).to.deep.equal([b, c, a]);
            });

            it("abc -> acb", () => {
                store.rules.items = [a, b, c];
                store.draftRules.items = [a, c, b];

                store.saveRule([0]);
                expect(store.rules.items).to.deep.equal([a, b, c]);
                // ^ 'a' hasn't moved, so we don't update any positions
            });

            it("abc -> cb", () => {
                store.rules.items = [a, b, c];
                store.draftRules.items = [c, b];

                store.saveRule([1]);
                expect(store.rules.items).to.deep.equal([a, c, b]);

                store.saveRules();
                expect(store.rules.items).to.deep.equal([c, b]);
            });

            it("ac -> abc", () => {
                store.rules.items = [a, c];
                store.draftRules.items = [a, b, c];

                store.saveRule([1]);
                expect(store.rules.items).to.deep.equal([a, b, c]);

                store.saveRules();
                expect(store.rules.items).to.deep.equal([a, b, c]);
            });

            it("abcdef -> fdca", () => {
                store.rules.items = [a, b, c, d, e, f];
                store.draftRules.items = [f, d, c, a];

                store.saveRule([1]);
                expect(store.rules.items).to.deep.equal([f, b, d, c, e, a]);
            });

            it("a[bc]d -> a[cb]d", () => {
                store.rules.items = [a, group(1, b, c), d];
                store.draftRules.items = [a, group(1, c, b), d];

                store.saveRule([1, 0]);

                expect(store.rules.items).to.deep.equal([a, group(1, c, b), d]);
            });

            it("a[bc]d -> a[b]cd", () => {
                store.rules.items = [a, group(1, b, c), d];
                store.draftRules.items = [a, group(1, b), c, d];

                store.saveRule([2]);

                expect(store.rules.items).to.deep.equal([a, group(1, b), c, d]);
            });

            it("a[b]cd -> a[cb]d", () => {
                store.rules.items = [a, group(1, b), c, d];
                store.draftRules.items = [a, group(1, c, b), d];

                store.saveRule([1, 0]);

                expect(store.rules.items).to.deep.equal([a, group(1, c, b), d]);
            });

            it("a[b]cd -> a[cb]d", () => {
                store.rules.items = [a, group(1, b), c, d];
                store.draftRules.items = [a, group(1, c, b), d];

                store.saveRule([1, 0]);

                expect(store.rules.items).to.deep.equal([a, group(1, c, b), d]);
            });

            it("a[b] -> [ab]", () => {
                store.rules.items = [a, group(1, b)];
                store.draftRules.items = [group(1, a, b)];

                store.saveRule([0, 0]);

                expect(store.rules.items).to.deep.equal([group(1, a, b)]);
            });
        });

        describe("should update one position for a single reset, if required", () => {
            it("abc -> bca", () => {
                store.rules.items = [a, b, c];
                store.draftRules.items = [b, c, a];

                store.resetRule([1]);
                expect(store.draftRules.items).to.deep.equal([b, a, c]);
            });

            it("abc -> cb", () => {
                store.rules.items = [a, b, c];
                store.draftRules.items = [c, b];

                store.resetRule([1]);
                expect(store.draftRules.items).to.deep.equal([b, c]);
            });

            it("abcdef -> fdca", () => {
                store.rules.items = [a, c, d, f];
                store.draftRules.items = [f, d, c, a];

                store.resetRule([1]);
                expect(store.draftRules.items).to.deep.equal([f, c, d, a]);

                store.resetRule([3]);
                expect(store.draftRules.items).to.deep.equal([a, f, c, d]);

                store.resetRule([1]);
                expect(store.draftRules.items).to.deep.equal([a, c, d, f]);
            });

            it("fa -> abcdef", () => {
                store.rules.items = [f, a];
                store.draftRules.items = [a, b, c, d, e, f];

                store.resetRule([5]);
                expect(store.draftRules.items).to.deep.equal([f, a, b, c, d, e]);
            });

            it("a[bc]d -> a[cb]d", () => {
                store.rules.items = [a, group(1, b, c), d];
                store.draftRules.items = [a, group(1, c, b), d];

                store.resetRule([1, 0]);

                expect(store.draftRules.items).to.deep.equal([a, group(1, b, c), d]);
            });

            it("a[bc]d -> [cab]d", () => {
                store.rules.items = [a, group(1, b, c), d];
                store.draftRules.items = [group(1, c, a, b), d];

                store.resetRule([0, 2]);

                expect(store.draftRules.items).to.deep.equal([group(1, b, c, a), d]);
            });

            it("a[b]cd -> a[cb]d", () => {
                store.rules.items = [a, group(1, b), c, d];
                store.draftRules.items = [a, group(1, c, b), d];

                store.resetRule([1, 1]);
                expect(store.draftRules.items).to.deep.equal([a, group(1, c, b), d]);

                store.resetRule([1, 0]);
                expect(store.draftRules.items).to.deep.equal([a, group(1, b), c, d]);
            });

            it("a[bcd]e -> [cb]", () => {
                store.rules.items = [a, group(1, b, c, d), e];
                store.draftRules.items = [group(1, c, b)];

                store.resetRule([0, 1]);

                expect(store.draftRules.items).to.deep.equal([group(1, b, c)]);
            });

            it("a[b] -> [ab]", () => {
                store.rules.items = [a, group(1, b)];
                store.draftRules.items = [group(1, a, b)];

                store.resetRule([0, 0]);

                expect(store.draftRules.items).to.deep.equal([a, group(1, b)]);
            });
        });

        describe("should allow moving draft rules", () => {
            it("abc -> acb", () => {
                store.draftRules.items = [a, b, c];

                store.moveDraftRule([1], [2]);

                expect(store.draftRules.items).to.deep.equal([a, c, b]);
            });

            it("a[bc]d -> [abc]d", () => {
                store.draftRules.items = [a, group(1, b, c), d];

                store.moveDraftRule([0], [1, 0]);

                expect(store.draftRules.items).to.deep.equal([group(1, a, b, c), d]);
            });

            it("a[bc]d -> [bac]d", () => {
                store.draftRules.items = [a, group(1, b, c), d];

                store.moveDraftRule([0], [1, 1]);

                expect(store.draftRules.items).to.deep.equal([group(1, b, a, c), d]);
            });
        });

        describe("should allow deleting draft rules", () => {
            it("abc -> ac", () => {
                store.draftRules.items = [a, b, c];

                store.deleteDraftRule([1]);

                expect(store.draftRules.items).to.deep.equal([a, c]);
            });
        });
    });
});