import * as _ from 'lodash';

import { expect } from '../../../test-setup';

import {
    FilterSet,
    SelectableSearchFilterClasses, StringFilter
} from "../../../../src/model/filters/search-filters";
import {
    applySuggestionToFilters,
    applySuggestionToText,
    getSuggestions
} from "../../../../src/model/filters/filter-matching";
import { getExchangeData, getFailedTls } from '../../unit-test-helpers';

describe("Search filter model integration test:", () => {
    describe("Simple filter usage", () => {
        it("should suggest all filter names given no input", () => {
            const suggestions = getSuggestions(SelectableSearchFilterClasses, "");

            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 0, showAs: "status" },
                { index: 0, showAs: "is-completed" },
                { index: 0, showAs: "is-pending" },
                { index: 0, showAs: "is-aborted" },
                { index: 0, showAs: "is-error" },
                { index: 0, showAs: "httpVersion" },
                { index: 0, showAs: "method" },
                { index: 0, showAs: "hostname" },
                { index: 0, showAs: "port" }
            ]);
        });

        it("should suggest nothing given free text input", () => {
            const suggestions = getSuggestions(SelectableSearchFilterClasses, "free text");

            expect(suggestions).to.deep.equal([]);
        });

        [
            "status=404",
            "is-completed",
            "is-pending",
            "is-aborted",
            "is-error",
            "httpVersion=2",
            "method=POST",
            "hostname=httptoolkit.tech",
            "port=8080",
        ].forEach((filterString) => {
            it(`should allow creating a filters from ${filterString}`, () => {
                const initialFilters: FilterSet = [new StringFilter(filterString)];

                const suggestions = getSuggestions(
                    SelectableSearchFilterClasses,
                    initialFilters[0].filter
                );

                expect(suggestions.length).to.equal(1);

                const updatedFilters = applySuggestionToFilters(initialFilters, suggestions[0]);

                expect(updatedFilters.length).to.equal(2);
                expect(updatedFilters[0]!.filter).to.equal("");

                const createdFilter = updatedFilters[1]!;
                expect(createdFilter.toString().length).to.be.greaterThan(0);

                const exampleEvents = [
                    getExchangeData({ statusCode: 404 }),
                    getExchangeData({ responseState: 'pending' }),
                    getExchangeData({ responseState: 'aborted' }),
                    getFailedTls(),
                    getExchangeData({ httpVersion: '2.0' }),
                    getExchangeData({ method: 'POST' }),
                    getExchangeData({ hostname: 'httptoolkit.tech' }),
                    getExchangeData({ hostname: 'example.com:8080' }),
                ];

                // Each filter must successfully match at least one item from our example list:
                const matchedEvents = exampleEvents.filter(e => createdFilter.matches(e));
                expect(matchedEvents.length).to.be.greaterThan(0);
                // But not all of them:
                expect(matchedEvents.length).to.be.lessThan(exampleEvents.length);
            });
        });
    });

    describe("Entering a search filter", () => {
        it("should suggest status operators once it's clear you want status", () => {
            const suggestions = getSuggestions(SelectableSearchFilterClasses, "sta");

            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 0, showAs: "status>=" },
                { index: 0, showAs: "status<=" },
                { index: 0, showAs: "status!=" },
                { index: 0, showAs: "status=" },
                { index: 0, showAs: "status>" },
                { index: 0, showAs: "status<" }
            ]);
        });

        it("should suggest a status number once you pick an operator", () => {
            let input = "sta";

            let suggestions = getSuggestions(SelectableSearchFilterClasses, input);
            input = applySuggestionToText(input, _.last(suggestions)!);

            suggestions = getSuggestions(SelectableSearchFilterClasses, input);

            expect(input).to.equal("status<")
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 7, showAs: "{3-digit number}" }
            ]);
        });

        it("should complete a fully entered search filter", () => {
            let filters: FilterSet = [
                new StringFilter("status>=300")
            ];

            let suggestions = getSuggestions(SelectableSearchFilterClasses, filters[0].filter);

            expect(suggestions.length).to.equal(1);
            filters = applySuggestionToFilters(filters, suggestions[0])

            expect(filters.length).to.equal(2);
            expect(filters[0]!.filter).to.equal("");
            expect(filters[1]!.toString()).to.equal("Status >= 300");
        });
    });
});