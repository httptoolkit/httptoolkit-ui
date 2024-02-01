import { RulesStore } from "../../../src/model/rules/rules-store";
import { HtkMockRule } from "../../../src/model/rules/rules";
import {
    HtkMockRuleRoot,
    HtkMockItem
} from "../../../src/model/rules/rules-structure";

import { expect } from "../../test-setup";
import { HttpMockRule } from "../../../src/model/rules/definitions/http-rule-definitions";

const group = (id: number, ...items: Array<HtkMockItem>) => ({
    id: id.toString(),
    title: id.toString(),
    items
});

const defaultGroup = (...items: Array<HtkMockItem>) => ({
    id: 'default-group',
    title: "Default rules",
    collapsed: true,
    items
});

describe("Rules store", () => {

    let store: RulesStore;
    let [a, b, c, d, e, f] = 'abcdef'
        .split('')
        .map((char) => ({ id: char }) as HtkMockRule);

    beforeEach(() => {
        const proxyStore = {
            serverVersion: '1.0.0',
            dnsServers: []
        };
        store = new RulesStore({ featureFlags: [] } as any, proxyStore as any, null as any);
        store.rules = { id: 'root', items: [] } as any as HtkMockRuleRoot;
        store.draftRules = { id: 'root', items: [] } as any as HtkMockRuleRoot;
    });

    describe("should update all positions for a single save, if the saved rule has moved", () => {
        it("abc -> bca", () => {
            store.rules.items = [a, b, c];
            store.draftRules.items = [b, c, a];

            store.saveItem([1]);
            expect(store.rules.items).to.deep.equal([b, c, a]);
        });

        it("abc -> acb", () => {
            store.rules.items = [a, b, c];
            store.draftRules.items = [a, c, b];

            store.saveItem([0]);
            expect(store.rules.items).to.deep.equal([a, b, c]);
            // ^ 'a' hasn't moved, so we don't update any positions
        });

        it("abc -> cb", () => {
            store.rules.items = [a, b, c];
            store.draftRules.items = [c, b];

            store.saveItem([1]);
            expect(store.rules.items).to.deep.equal([a, c, b]);

            store.saveRules();
            expect(store.rules.items).to.deep.equal([c, b]);
        });

        it("ac -> abc", () => {
            store.rules.items = [a, c];
            store.draftRules.items = [a, b, c];

            store.saveItem([1]);
            expect(store.rules.items).to.deep.equal([a, b, c]);

            store.saveRules();
            expect(store.rules.items).to.deep.equal([a, b, c]);
        });

        it("abcdef -> fdca", () => {
            store.rules.items = [a, b, c, d, e, f];
            store.draftRules.items = [f, d, c, a];

            store.saveItem([1]);
            expect(store.rules.items).to.deep.equal([f, b, d, c, e, a]);
        });

        it("a[bc]d -> a[cb]d", () => {
            store.rules.items = [a, group(1, b, c), d];
            store.draftRules.items = [a, group(1, c, b), d];

            store.saveItem([1, 0]);

            expect(store.rules.items).to.deep.equal([a, group(1, c, b), d]);
        });

        it("a[bc]d -> a[b]cd", () => {
            store.rules.items = [a, group(1, b, c), d];
            store.draftRules.items = [a, group(1, b), c, d];

            store.saveItem([2]);

            expect(store.rules.items).to.deep.equal([a, group(1, b), c, d]);
        });

        it("a[b]cd -> a[cb]d", () => {
            store.rules.items = [a, group(1, b), c, d];
            store.draftRules.items = [a, group(1, c, b), d];

            store.saveItem([1, 0]);

            expect(store.rules.items).to.deep.equal([a, group(1, c, b), d]);
        });

        it("a[b]cd -> a[cb]d", () => {
            store.rules.items = [a, group(1, b), c, d];
            store.draftRules.items = [a, group(1, c, b), d];

            store.saveItem([1, 0]);

            expect(store.rules.items).to.deep.equal([a, group(1, c, b), d]);
        });

        it("a[b] -> [ab]", () => {
            store.rules.items = [a, group(1, b)];
            store.draftRules.items = [group(1, a, b)];

            store.saveItem([0, 0]);

            expect(store.rules.items).to.deep.equal([group(1, a, b)]);
        });

        it("a -> a[b]", () => {
            store.rules.items = [a];
            store.draftRules.items = [a, group(1, b)];

            store.saveItem([1, 0]);

            expect(store.rules.items).to.deep.equal([a, group(1, b)]);
        });

        it("a -> [b]a", () => {
            store.rules.items = [a];
            store.draftRules.items = [group(1, b), a];

            store.saveItem([0, 0]);

            expect(store.rules.items).to.deep.equal([group(1, b), a]);
        });

        it("b -> [[abc]]", () => {
            store.rules.items = [b];
            store.draftRules.items = [group(1, group(2, a, b, c))];

            store.saveItem([0, 0, 1]);
            expect(store.rules.items).to.deep.equal([group(1, group(2, b))]);

            store.saveItem([0, 0, 2]);
            expect(store.rules.items).to.deep.equal([group(1, group(2, b, c))]);

            store.saveItem([0, 0, 0]);
            expect(store.rules.items).to.deep.equal([group(1, group(2, a, b, c))]);
        });

        it("[[abc]] -> cba", () => {
            store.rules.items = [group(1, group(2, a, b, c))];
            store.draftRules.items = [c, b, a];

            store.saveItem([1]);
            expect(store.rules.items).to.deep.equal([group(1, group(2, a, c)), b]);

            store.saveItem([0]);
            expect(store.rules.items).to.deep.equal([group(1, group(2, a)), c, b]);

            store.saveItem([2]);
            expect(store.rules.items).to.deep.equal([c, b, a]);
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

        it("[a][[b]] -> [ab]", () => {
            store.rules.items = [group(1, a), group(2, group(3, group(4, b)))];
            store.draftRules.items = [group(3, a, b)];

            store.resetRule([0, 0]);
            expect(store.draftRules.items).to.deep.equal([group(1, a), group(3, b)]);

            store.resetRule([1, 0]);
            expect(store.draftRules.items).to.deep.equal([
                group(1, a),
                group(3, group(4, b))
            ]);
        });

        it("[[abc]] -> cba", () => {
            store.rules.items = [group(1, group(2, a, b, c))];
            store.draftRules.items = [c, b, a];

            store.resetRule([1]);
            expect(store.draftRules.items).to.deep.equal([group(1, group(2, b)), c, a]);

            store.resetRule([1]);
            expect(store.draftRules.items).to.deep.equal([group(1, group(2, b, c)), a]);

            store.resetRule([1]);
            expect(store.draftRules.items).to.deep.equal([group(1, group(2, a, b, c))]);
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

            store.deleteDraftItem([1]);

            expect(store.draftRules.items).to.deep.equal([a, c]);
        });
    });

    describe("default rule management", () => {

        it("should create rules & the default group if neither exist", () => {
            store.ensureRuleExists(a);

            expect(store.rules.items).to.deep.equal([defaultGroup(a)]);
            expect(store.draftRules.items).to.deep.equal([defaultGroup(a)]);
        });

        it("should do nothing if the rule exists in the group", () => {
            store.rules.items = [defaultGroup(a)];
            store.draftRules.items = [defaultGroup(a)];

            store.ensureRuleExists(a);

            expect(store.rules.items).to.deep.equal([defaultGroup(a)]);
            expect(store.draftRules.items).to.deep.equal([defaultGroup(a)]);
        });

        it("should save the rule if it only exists as a draft", () => {
            store.rules.items = [];
            store.draftRules.items = [defaultGroup(a)];

            store.ensureRuleExists(a);

            expect(store.rules.items).to.deep.equal([defaultGroup(a)]);
            expect(store.draftRules.items).to.deep.equal([defaultGroup(a)]);
        });

        it("should create a draft if the rule is draft-deleted", () => {
            store.rules.items = [defaultGroup(a)];
            store.draftRules.items = [];

            store.ensureRuleExists(a);

            expect(store.rules.items).to.deep.equal([defaultGroup(a)]);
            expect(store.draftRules.items).to.deep.equal([defaultGroup(a)]);
        });

        it("should prepend the rule to the group, if there's a group without the rule", () => {
            store.rules.items = [defaultGroup(a)];
            store.draftRules.items = [defaultGroup(a)];

            store.ensureRuleExists(b);

            expect(store.rules.items).to.deep.equal([defaultGroup(b, a)]);
            expect(store.draftRules.items).to.deep.equal([defaultGroup(b, a)]);
        });

        it("should do nothing if the rule exists, but outside the group", () => {
            store.rules.items = [a];
            store.draftRules.items = [a];

            store.ensureRuleExists(a);

            expect(store.rules.items).to.deep.equal([a]);
            expect(store.draftRules.items).to.deep.equal([a]);
        });

        it("should update the rule if it exists but with changes", () => {
            store.rules.items = [{ ...a, activated: false }];
            store.draftRules.items = [{ ...a, activated: false }];

            store.ensureRuleExists(a);

            expect(store.rules.items).to.deep.equal([a]);
            expect(store.draftRules.items).to.deep.equal([a]);
        });

        it("should update the rule if it exists but missing its priority", () => {
            store.rules.items = [defaultGroup(a)];
            store.draftRules.items = [defaultGroup(a)];

            const highPriorityRule = { ...a, priority: 10 } as HttpMockRule;

            store.ensureRuleExists(highPriorityRule);

            expect(store.rules.items).to.deep.equal([defaultGroup(highPriorityRule)]);
            expect(store.draftRules.items).to.deep.equal([defaultGroup(highPriorityRule)]);
        });
    });
});