import { expect } from '../../test-setup';

import { TransformingStep } from '../../../src/model/rules/definitions/http-rule-definitions';
import {
    serializeRules,
    deserializeRules
} from '../../../src/model/rules/rule-serialization';

const fakeRulesStore = { activePassthroughOptions: {} } as any;

describe("Transforming step serialization", () => {

    it("survives a round-trip with a matchReplaceHeaders transform", () => {
        const step = new TransformingStep(fakeRulesStore, {
            matchReplaceHeaders: {
                'cookie': [
                    [/iamSessionIdExpiryDateInUtc=[^;]+/g, 'iamSessionIdExpiryDateInUtc=123231232']
                ]
            }
        }, {});

        const rules = {
            id: 'root',
            title: "Rules",
            isRoot: true,
            items: [{
                id: 'rule-1',
                type: 'http',
                activated: true,
                matchers: [],
                steps: [step]
            }]
        } as any;

        const restoredRules = deserializeRules(
            JSON.parse(JSON.stringify(serializeRules(rules))),
            { rulesStore: fakeRulesStore }
        );

        const restoredStep = (restoredRules.items[0] as any).steps[0];

        expect(restoredStep).to.be.instanceOf(TransformingStep);

        const pairs = restoredStep.transformRequest!.matchReplaceHeaders!['cookie'];
        expect(pairs).to.have.length(1);

        const [pattern, replacement] = pairs[0];
        expect(pattern).to.be.instanceOf(RegExp);
        expect(pattern.source).to.equal('iamSessionIdExpiryDateInUtc=[^;]+');
        expect(pattern.flags).to.equal('g');
        expect(replacement).to.equal('iamSessionIdExpiryDateInUtc=123231232');

        // The restored regex actually works as expected:
        expect(
            'a=1; iamSessionIdExpiryDateInUtc=2026-06-12T00:00:00Z; b=2'.replace(pattern, replacement)
        ).to.equal('a=1; iamSessionIdExpiryDateInUtc=123231232; b=2');
    });

});
