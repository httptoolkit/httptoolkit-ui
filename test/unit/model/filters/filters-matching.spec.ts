import { expect } from '../../../test-setup';

import { matchFilters } from "../../../../src/model/filters/filter-matching";
import { FixedStringSyntax, SyntaxPart } from '../../../../src/model/filters/syntax-parts';
import { FilterClass, StringFilter } from '../../../../src/model/filters/search-filters';

const mockFilterClass = (syntaxParts: SyntaxPart[]) => (class MockFilterClass {
    static filterSyntax = syntaxParts;
    constructor(
        public builtFrom: string
    ) {}
} as unknown as FilterClass);

type MockFilter = { builtFrom?: string };

describe("Filter matching", () => {
    it("should match exactly matching filter classes", () => {
        const availableFilters = [
            mockFilterClass([new FixedStringSyntax('qwe'), new FixedStringSyntax('asd')]),
            mockFilterClass([new FixedStringSyntax('asd'), new FixedStringSyntax('qwe')])
        ]

        const match = matchFilters(availableFilters, "qweasd");

        expect(match.length).to.equal(2);
        expect(match[0]).to.be.instanceOf(StringFilter);
        expect((match[0] as StringFilter).filter).to.equal("");

        expect(match[1]).to.be.instanceOf(availableFilters[0]);
        expect((match[1] as MockFilter).builtFrom).to.equal("qweasd");
    });

    it("shouldn't match filter classes with only partially matching components", () => {
        const availableFilters = [
            mockFilterClass([new FixedStringSyntax('qwe'), new FixedStringSyntax('asd')]),
            mockFilterClass([new FixedStringSyntax('asd'), new FixedStringSyntax('qwe')])
        ]

        const match = matchFilters(availableFilters, "qw");

        expect(match.length).to.equal(1);
        expect(match[0]).to.be.instanceOf(StringFilter);
        expect((match[0] as StringFilter).filter).to.equal("qw");
    });

    it("shouldn't match filter classes with a full + partial matching components", () => {
        const availableFilters = [
            mockFilterClass([new FixedStringSyntax('qwe'), new FixedStringSyntax('asd')]),
            mockFilterClass([new FixedStringSyntax('asd'), new FixedStringSyntax('qwe')])
        ]

        const match = matchFilters(availableFilters, "qweas");

        expect(match.length).to.equal(1);
        expect(match[0]).to.be.instanceOf(StringFilter);
        expect((match[0] as StringFilter).filter).to.equal("qweas");
    });

    it("shouldn't match anything given an empty string", () => {
        const availableFilters = [
            mockFilterClass([new FixedStringSyntax('qwe'), new FixedStringSyntax('asd')]),
            mockFilterClass([new FixedStringSyntax('asd'), new FixedStringSyntax('qwe')])
        ]

        const match = matchFilters(availableFilters, "");

        expect(match.length).to.equal(1);
        expect(match[0]).to.be.instanceOf(StringFilter);
        expect((match[0] as StringFilter).filter).to.equal("");
    });

    it("should match ignoring outside whitespace", () => {
        const availableFilters = [
            mockFilterClass([new FixedStringSyntax('qwe'), new FixedStringSyntax('asd')]),
            mockFilterClass([new FixedStringSyntax('asd'), new FixedStringSyntax('qwe')])
        ]

        const match = matchFilters(availableFilters, "   qweasd   ");

        expect(match.length).to.equal(2);
        expect(match[0]).to.be.instanceOf(StringFilter);
        expect((match[0] as StringFilter).filter).to.equal("");

        expect(match[1]).to.be.instanceOf(availableFilters[0]);
        expect((match[1] as MockFilter).builtFrom).to.equal("qweasd");
    });

    it("should match multiple filters", () => {
        const availableFilters = [
            mockFilterClass([new FixedStringSyntax('qwe'), new FixedStringSyntax('asd')]),
            mockFilterClass([new FixedStringSyntax('asd'), new FixedStringSyntax('qwe')])
        ]

        const match = matchFilters(availableFilters, "asdqwe qweasd 123");

        expect(match.length).to.equal(3);
        expect(match[0]).to.be.instanceOf(StringFilter);
        expect((match[0] as StringFilter).filter).to.equal("123");

        expect(match[1]).to.be.instanceOf(availableFilters[0]);
        expect((match[1] as MockFilter).builtFrom).to.equal("qweasd");

        expect(match[2]).to.be.instanceOf(availableFilters[1]);
        expect((match[2] as MockFilter).builtFrom).to.equal("asdqwe");
    });
});