import { expect } from '../../../test-setup';

import { matchFilters, getSuggestions } from "../../../../src/model/filters/filter-matching";
import { FilterClass, StringFilter } from '../../../../src/model/filters/search-filters';
import {
    SyntaxPart,
    FixedStringSyntax,
    StringOptionsSyntax, FixedLengthNumberSyntax, NumberSyntax
} from '../../../../src/model/filters/syntax-parts';

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

describe("Suggestion generation", () => {
    it("should suggest completing a string part", () => {
        const availableFilters = [
            mockFilterClass([new FixedStringSyntax('qwe')])
        ];

        const suggestions = getSuggestions(availableFilters, "qw");

        expect(suggestions[0]).to.deep.equal({
            index: 0,
            showAs: "qwe",
            value: "qwe",
            filterClass: availableFilters[0]
        });
    });

    it("should only show exact completions given an exact match", () => {
        const availableFilters = [
            mockFilterClass([new FixedStringSyntax('qwe')]),
            mockFilterClass([new FixedStringSyntax('qweasd')])
        ];

        const suggestions = getSuggestions(availableFilters, "qwe");

        expect(suggestions).to.deep.equal([
            {
                index: 0,
                showAs: "qwe",
                value: "qwe",
                filterClass: availableFilters[0]
            }
        ]);
    });

    it("should not suggest completions after the end of the match", () => {
        const availableFilters = [
            mockFilterClass([new FixedStringSyntax('status')])
        ];

        const suggestions = getSuggestions(availableFilters, "statuses");

        expect(suggestions.length).to.equal(0);
    });

    it("should suggest completions at the end of the string", () => {
        const availableFilters = [
            mockFilterClass([new FixedStringSyntax('qwe'), new FixedStringSyntax('asd')]),
        ];

        const suggestions = getSuggestions(availableFilters, "qwe");

        expect(suggestions[0]).to.deep.equal({
            index: 3,
            showAs: "asd",
            value: "asd",
            filterClass: availableFilters[0]
        });
    });

    it("should suggest the matching string options", () => {
        const availableFilters = [
            mockFilterClass([new StringOptionsSyntax(['ab', 'ac', 'def'])])
        ];

        const suggestions = getSuggestions(availableFilters, "a");

        expect(suggestions).to.deep.equal([
            {
                index: 0,
                showAs: "ab",
                value: "ab",
                filterClass: availableFilters[0]
            },
            {
                index: 0,
                showAs: "ac",
                value: "ac",
                filterClass: availableFilters[0]
            },
        ]);
    });

    it("should include suggestions from multiple filters", () => {
        const availableFilters = [
            mockFilterClass([new FixedStringSyntax('abcdef')]),
            mockFilterClass([new StringOptionsSyntax(['ab', 'ac'])])
        ];

        const suggestions = getSuggestions(availableFilters, "a");

        expect(suggestions).to.deep.equal([
            {
                index: 0,
                showAs: "abcdef",
                value: "abcdef",
                filterClass: availableFilters[0]
            },
            {
                index: 0,
                showAs: "ab",
                value: "ab",
                filterClass: availableFilters[1]
            },
            {
                index: 0,
                showAs: "ac",
                value: "ac",
                filterClass: availableFilters[1]
            },
        ]);
    });

    it("should include suggestions for the initial unmatched part of a filter", () => {
        const availableFilters = [
            mockFilterClass([
                new StringOptionsSyntax(['ab', 'ac']),
                new StringOptionsSyntax(['=', '>=', '<=']),
            ])
        ];

        const suggestions = getSuggestions(availableFilters, "a");

        expect(suggestions).to.deep.equal([
            {
                index: 0,
                showAs: "ab",
                value: "ab",
                filterClass: availableFilters[0]
            },
            {
                index: 0,
                showAs: "ac",
                value: "ac",
                filterClass: availableFilters[0]
            }
        ]);
    });

    it("should include suggestions for subsequent unmatched parts of a filter", () => {
        const availableFilters = [
            mockFilterClass([
                new StringOptionsSyntax(['ab', 'ac']),
                new StringOptionsSyntax(['=', '>=', '<=']),
            ])
        ];

        const suggestions = getSuggestions(availableFilters, "ab");

        expect(suggestions).to.deep.equal([
            {
                index: 2,
                showAs: ">=",
                value: ">=",
                filterClass: availableFilters[0]
            },
            {
                index: 2,
                showAs: "<=",
                value: "<=",
                filterClass: availableFilters[0]
            },
            {
                index: 2,
                showAs: "=",
                value: "=",
                filterClass: availableFilters[0]
            }
        ]);
    });

    it("should skip suggestions forwards given a full+partial option match in one part of a filter", () => {
        const availableFilters = [
            mockFilterClass([
                new FixedStringSyntax("status"),
                new StringOptionsSyntax(['=', '==']),
                new FixedLengthNumberSyntax(3)
            ])
        ];

        const suggestions = getSuggestions(availableFilters, "status=");

        expect(suggestions).to.deep.equal([
            {
                index: 7,
                showAs: "<3-digit number>",
                value: "000",
                filterClass: availableFilters[0]
            }
            // I.e. it doesn't show == here, it shows the final suggestion instead, since
            // that's probably what you're looking for now.
        ]);
    });

    it("should include suggestions for most full-matched option, given multiple options", () => {
        // Similar to the above test, but given competing filters, not competing string options
        const availableFilters = [
            mockFilterClass([new FixedStringSyntax('bodySize'), new StringOptionsSyntax(['=', '>=', '<='])]),
            mockFilterClass([new FixedStringSyntax('body'), new StringOptionsSyntax(['=', '=='])])
        ];

        const suggestions = getSuggestions(availableFilters, "body");

        expect(suggestions).to.deep.equal([
            {
                index: 4,
                showAs: "==",
                value: "==",
                filterClass: availableFilters[1]
            },
            {
                index: 4,
                showAs: "=",
                value: "=",
                filterClass: availableFilters[1]
            }
        ]);
    });
});