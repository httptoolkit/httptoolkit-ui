import { expect } from '../../../test-setup';

import { FilterClass, StringFilter } from '../../../../src/model/filters/search-filters';

import {
    SyntaxPart
} from '../../../../src/model/filters/syntax-matching';
import {
    FixedStringSyntax,
    StringOptionsSyntax,
    FixedLengthNumberSyntax,
    NumberSyntax,
    StringSyntax
} from '../../../../src/model/filters/syntax-parts';

import {
    matchFilters,
    getFilterSuggestions,
    applySuggestionToFilters,
    buildCustomFilter
} from "../../../../src/model/filters/filter-matching";

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

        const suggestions = getFilterSuggestions(availableFilters, "qw");

        expect(suggestions[0]).to.deep.equal({
            index: 0,
            showAs: "qwe",
            value: "qwe",
            filterClass: availableFilters[0],
            matchType: 'full'
        });
    });

    it("should only show exact completions given an exact match", () => {
        const availableFilters = [
            mockFilterClass([new FixedStringSyntax('qwe')]),
            mockFilterClass([new FixedStringSyntax('qweasd')])
        ];

        const suggestions = getFilterSuggestions(availableFilters, "qwe");

        expect(suggestions).to.deep.equal([
            {
                index: 0,
                showAs: "qwe",
                value: "qwe",
                filterClass: availableFilters[0],
                matchType: 'full'
            }
        ]);
    });

    it("should suggest mid-input completions", () => {
        const availableFilters = [
            mockFilterClass([new FixedStringSyntax('qwe'), new FixedStringSyntax('asd')]),
        ];

        const suggestions = getFilterSuggestions(availableFilters, "qwea");

        expect(suggestions[0]).to.deep.equal({
            index: 3,
            showAs: "asd",
            value: "asd",
            filterClass: availableFilters[0],
            matchType: 'full'
        });
    });

    it("should suggest the final part, given a multi-step full match", () => {
        const availableFilters = [
            mockFilterClass([new FixedStringSyntax('qwe'), new NumberSyntax()])
        ];

        const suggestions = getFilterSuggestions(availableFilters, "qwe123");

        expect(suggestions).to.deep.equal([
            {
                index: 3,
                showAs: "123",
                value: "123",
                filterClass: availableFilters[0],
                matchType: 'full'
            }
        ]);
    });

    it("should not suggest completions after the end of the match", () => {
        const availableFilters = [
            mockFilterClass([new FixedStringSyntax('status')])
        ];

        const suggestions = getFilterSuggestions(availableFilters, "statuses");

        expect(suggestions.length).to.equal(0);
    });

    it("should suggest the matching string options", () => {
        const availableFilters = [
            mockFilterClass([new StringOptionsSyntax(['ab', 'ac', 'def'])])
        ];

        const suggestions = getFilterSuggestions(availableFilters, "a");

        expect(suggestions).to.deep.equal([
            {
                index: 0,
                showAs: "ab",
                value: "ab",
                filterClass: availableFilters[0],
                matchType: 'full'
            },
            {
                index: 0,
                showAs: "ac",
                value: "ac",
                filterClass: availableFilters[0],
                matchType: 'full'
            },
        ]);
    });

    it("should include suggestions from multiple filters", () => {
        const availableFilters = [
            mockFilterClass([new FixedStringSyntax('abcdef')]),
            mockFilterClass([new StringOptionsSyntax(['ab', 'ac'])])
        ];

        const suggestions = getFilterSuggestions(availableFilters, "a");

        expect(suggestions).to.deep.equal([
            {
                index: 0,
                showAs: "abcdef",
                value: "abcdef",
                filterClass: availableFilters[0],
                matchType: 'full'
            },
            {
                index: 0,
                showAs: "ab",
                value: "ab",
                filterClass: availableFilters[1],
                matchType: 'full'
            },
            {
                index: 0,
                showAs: "ac",
                value: "ac",
                filterClass: availableFilters[1],
                matchType: 'full'
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

        const suggestions = getFilterSuggestions(availableFilters, "a");

        expect(suggestions).to.deep.equal([
            {
                index: 0,
                showAs: "ab",
                value: "ab",
                filterClass: availableFilters[0],
                matchType: 'partial'
            },
            {
                index: 0,
                showAs: "ac",
                value: "ac",
                filterClass: availableFilters[0],
                matchType: 'partial'
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

        const suggestions = getFilterSuggestions(availableFilters, "ab");

        expect(suggestions).to.deep.equal([
            {
                index: 0,
                showAs: "ab=",
                value: "ab=",
                filterClass: availableFilters[0],
                matchType: 'full'
            },
            {
                index: 0,
                showAs: "ab>=",
                value: "ab>=",
                filterClass: availableFilters[0],
                matchType: 'full'
            },
            {
                index: 0,
                showAs: "ab<=",
                value: "ab<=",
                filterClass: availableFilters[0],
                matchType: 'full'
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

        const suggestions = getFilterSuggestions(availableFilters, "status=");

        expect(suggestions).to.deep.equal([
            {
                index: 6,
                showAs: "={3-digit number}",
                value: "=",
                filterClass: availableFilters[0],
                matchType: 'template'
            }
            // I.e. it doesn't show == here, it shows the final suggestion instead, since
            // that's probably what you're looking for now.
        ]);
    });

    it("should include suggestions for the most-matched option, given multiple full matches", () => {
        // Similar to the above test, but given competing filters, not competing string options
        const availableFilters = [
            mockFilterClass([
                new FixedStringSyntax('bodySize'),
                new StringOptionsSyntax(['=', '>=', '<='])
            ]),
            mockFilterClass([
                new FixedStringSyntax('body'),
                new StringOptionsSyntax(['=', '=='])
            ])
        ];

        const suggestions = getFilterSuggestions(availableFilters, "body");

        expect(suggestions).to.deep.equal([
            {
                index: 0,
                showAs: "body=",
                value: "body=",
                filterClass: availableFilters[1],
                matchType: 'full'
            },
            {
                index: 0,
                showAs: "body==",
                value: "body==",
                filterClass: availableFilters[1],
                matchType: 'full'
            }
        ]);
    });

    it("should combine suggestions given single option parts of a filter", () => {
        const availableFilters = [
            mockFilterClass([
                new FixedStringSyntax('status'),
                new StringOptionsSyntax(['=', '>=', '<=']),
            ])
        ];

        const suggestions = getFilterSuggestions(availableFilters, "sta");

        expect(suggestions).to.deep.equal([
            {
                index: 0,
                showAs: "status=",
                value: "status=",
                filterClass: availableFilters[0],
                matchType: 'full'
            },
            {
                index: 0,
                showAs: "status>=",
                value: "status>=",
                filterClass: availableFilters[0],
                matchType: 'full'
            },
            {
                index: 0,
                showAs: "status<=",
                value: "status<=",
                filterClass: availableFilters[0],
                matchType: 'full'
            }
        ]);
    });

    it("should combine suggestions if all parts of a filter are single-option", () => {
        const availableFilters = [
            mockFilterClass([
                new FixedStringSyntax('status'),
                new StringOptionsSyntax(['=404']),
            ])
        ];

        const suggestions = getFilterSuggestions(availableFilters, "sta");

        expect(suggestions).to.deep.equal([
            {
                index: 0,
                showAs: "status=404",
                value: "status=404",
                filterClass: availableFilters[0],
                matchType: 'full'
            }
        ]);
    });

    it("should stop combining suggestions after a template given multiple options", () => {
        const availableFilters = [
            mockFilterClass([
                new FixedStringSyntax('bodySize='),
                new NumberSyntax(),
                new StringOptionsSyntax([
                    'bytes',
                    'megabytes'
                ])
            ])
        ];

        const suggestions = getFilterSuggestions(availableFilters, "bodySize");

        expect(suggestions).to.deep.equal([
            {
                index: 0,
                showAs: "bodySize={number}",
                value: "bodySize=",
                filterClass: availableFilters[0],
                matchType: 'template'
            }
        ]);
    });

    it("should combine unambiguous suggestions after a template, just visually", () => {
        const availableFilters = [
            mockFilterClass([
                new FixedStringSyntax('header[['),
                new StringSyntax("header name"),
                new FixedStringSyntax(']'),
                new FixedStringSyntax(']'),
                new StringOptionsSyntax([
                    '=',
                    '!='
                ])
            ])
        ];

        const suggestions = getFilterSuggestions(availableFilters, "head");

        expect(suggestions).to.deep.equal([
            {
                index: 0,
                showAs: "header[[{header name}]]",
                value: "header[[",
                filterClass: availableFilters[0],
                matchType: 'template'
            }
        ]);
    });
});

describe("Applying suggestions", () => {
    it("completes initial single-part suggestions", () => {
        const filterClass = mockFilterClass([
            new FixedStringSyntax('status'),
            new StringOptionsSyntax(['=404']),
        ]);

        const result = applySuggestionToFilters(
            [new StringFilter("sta")],
            {
                index: 0,
                value: "status",
                showAs: "STATUS",
                filterClass,
                matchType: 'partial'
            }
        );

        expect(result.length).to.equal(1);
        const updatedText = result[0].filter;
        expect(updatedText).to.equal("status");
    });

    it("completes second part suggestions", () => {
        const filterClass = mockFilterClass([
            new FixedStringSyntax('status'),
            new StringOptionsSyntax(['=', '!=']),
            new NumberSyntax()
        ]);

        const result = applySuggestionToFilters(
            [new StringFilter("status!")],
            {
                index: 6,
                value: "!=",
                showAs: "!=",
                filterClass,
                matchType: 'partial'
            }
        );

        expect(result.length).to.equal(1);
        const updatedText = result[0].filter;
        expect(updatedText).to.equal("status!=");
    });

    it("does nothing for template suggestions", () => {
        const filterClass = mockFilterClass([
            new FixedStringSyntax('status='),
            new NumberSyntax()
        ]);

        const result = applySuggestionToFilters(
            [new StringFilter("status=")],
            {
                index: 7,
                value: "",
                showAs: "{number}",
                filterClass,
                matchType: 'template'
            }
        );

        expect(result.length).to.equal(1);
        const updatedText = result[0].filter;
        expect(updatedText).to.equal("status=");
    });

    it("fully completes and creates filters with final part suggestions", () => {
        const filterClass = mockFilterClass([
            new FixedStringSyntax('status'),
            new StringOptionsSyntax(['=', '!=']),
            new NumberSyntax()
        ]);

        const result = applySuggestionToFilters(
            [new StringFilter("status!=40")],
            {
                index: 8,
                value: "404",
                showAs: "404",
                filterClass,
                matchType: 'full'
            }
        );

        expect(result.length).to.equal(2);

        const updatedText = result[0].filter;
        expect(updatedText).to.equal("");

        expect((result[1] as MockFilter).builtFrom).to.equal("status!=404");
    });

    it("can insert a custom filter", () => {
        const filterClasses = [mockFilterClass([
            new FixedStringSyntax('url'),
            new StringOptionsSyntax(['=', '^=', '$=']),
            new StringSyntax("a url")
        ])];

        const filterClass = buildCustomFilter(
            "custom",
            "url^=/api url$=/users",
            filterClasses
        );

        const result = applySuggestionToFilters(
            [new StringFilter("custom")],
            {
                index: 0,
                value: "custom",
                showAs: "custom",
                filterClass,
                matchType: 'full'
            }
        );

        expect(result.length).to.equal(3);

        const updatedText = result[0].filter;
        expect(updatedText).to.equal("");
        expect((result[1] as MockFilter).builtFrom).to.equal("url$=/users");
        expect((result[2] as MockFilter).builtFrom).to.equal("url^=/api");
    });
});