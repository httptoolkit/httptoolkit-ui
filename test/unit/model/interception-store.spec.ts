import { InterceptionStore } from "../../../src/model/interception-store";
import { HtkMockRule } from "../../../src/model/rules/rules";

import { expect } from "../../test-setup";

describe("Interception store", () => {
    describe("rules", () => {

        let store: InterceptionStore;
        let [a, b, c, d, e, f] = 'abcdef'
            .split('')
            .map((char) => ({ id: char }) as HtkMockRule);

        beforeEach(() => {
            store = new InterceptionStore(() => {});
            store.rules = [];
            store.draftRules = [];
        });

        describe("update all positions for a single save, if the saved rule has moved", () => {
            it("abc -> bca", () => {
                store.rules = [a, b, c];
                store.draftRules = [b, c, a];

                store.saveRule(1);
                expect(store.rules).to.deep.equal([b, c, a]);
            });

            it("abc -> acb", () => {
                store.rules = [a, b, c];
                store.draftRules = [a, c, b];

                store.saveRule(0);
                expect(store.rules).to.deep.equal([a, b, c]);
                // ^ 'a' hasn't moved, so we don't update any positions
            });

            it("abc -> cb", () => {
                store.rules = [a, b, c];
                store.draftRules = [c, b];

                store.saveRule(1);
                expect(store.rules).to.deep.equal([a, c, b]);

                store.saveRules();
                expect(store.rules).to.deep.equal([c, b]);
            });

            it("abcdef -> fdca", () => {
                store.rules = [a, b, c, d, e, f];
                store.draftRules = [f, d, c, a];

                store.saveRule(1);
                expect(store.rules).to.deep.equal([f, b, d, c, e, a]);
            });
        });

        describe("update one position for a single reset, if required", () => {
            it("abc -> bca", () => {
                store.rules = [a, b, c];
                store.draftRules = [b, c, a];

                store.resetRule(1);
                expect(store.draftRules).to.deep.equal([b, a, c]);
            });

            it("abc -> cb", () => {
                store.rules = [a, b, c];
                store.draftRules = [c, b];

                store.resetRule(1);
                expect(store.draftRules).to.deep.equal([c, b]);

                store.resetRule(0);
                expect(store.draftRules).to.deep.equal([b, c]);
            });

            it("abcdef -> fdca", () => {
                store.rules = [a, b, c, d, e, f];
                store.draftRules = [f, d, c, a];

                store.resetRule(1);
                expect(store.draftRules).to.deep.equal([f, c, a, d]);

                store.resetRule(2);
                expect(store.draftRules).to.deep.equal([a, f, c, d]);
            });

            it("fa -> abcdef", () => {
                store.rules = [f, a];
                store.draftRules = [a, b, c, d, e, f];

                store.resetRule(5);
                expect(store.draftRules).to.deep.equal([f, a, b, c, d, e]);
            });
        });
    });
});