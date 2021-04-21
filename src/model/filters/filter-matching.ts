import * as _ from 'lodash';

import {
    FilterClass,
    Filters,
    FilterSet,
    StringFilter
} from './search-filters';
import {
    SyntaxSuggestion,
    matchSyntax,
    applySuggestionToText,
    getSuggestions
} from './syntax-matching';
import { FixedStringSyntax } from './syntax-parts';

/**
 * Takes a full string, parses it completely for filters, and returns a
 * list of the parser result. Used when pasting a complete list of
 * filters into the search input.
 */
export function matchFilters(filterClasses: FilterClass[], value: string): FilterSet {
    let remainingString = value.trim();
    let filters = [];

    // Repeatedly parse filter from the start of the input
    while (remainingString.length > 0) {
        const firstFullMatch = filterClasses
            .map(filterClass => ({
                filterClass,
                match: matchSyntax(filterClass.filterSyntax, remainingString, 0)
            }))
            .filter((fm) => !!fm.match && fm.match.type === 'full')[0];

        if (!firstFullMatch) break;

        const consumed = firstFullMatch.match!.fullyConsumed;
        const matchedString = remainingString.slice(0, consumed);
        remainingString = remainingString.slice(consumed).trimLeft();

        // Unshift here, because filter array runs in reverse to the inputs
        filters.unshift(new firstFullMatch.filterClass(matchedString));
    }

    // We've either run out of string, or stopped being able to match anything
    // Turn the leftovers into a StringFilter, and return the whole lot:
    return [
        new StringFilter(remainingString),
        ..._.flatten(filters)
    ];
}

export interface FilterSuggestion extends SyntaxSuggestion {
    filterClass: FilterClass;
};

/**
 * Takes a full string, and given a list of filters, returns an
 * appropriate list of suggestions to show the user, with the filter
 * metadata required to immediately create the filters.
 *
 * Optionally also takes context, which may be used by some syntax
 * parts to provide more specific context-driven suggestions.
 */
export function getFilterSuggestions<T>(
    filters: FilterClass<T>[],
    value: string,
    context?: T
): FilterSuggestion[] {
    const suggestions = getSuggestions(
        filters.map((filterClass) => ({
            key: filterClass,
            syntax: filterClass.filterSyntax
        })),
        value,
        0,
        { context }
    )

    return suggestions.map(({ key: filterClass, suggestion }) => ({
        filterClass,
        ...suggestion,
    }));
}

/**
 * Given a selected suggestion and the current list of filters, returns
 * a new list of filters with the suggestion applied.
 *
 * This either updates the string content (given the suggestion for part
 * of a rule) or clears the string content and creates a new filter.
 */
export function applySuggestionToFilters(
    filterSet: FilterSet,
    suggestion: FilterSuggestion
): FilterSet {
    const text = filterSet[0].filter;

    const updatedText = applySuggestionToText(text, suggestion);

    if (suggestion.matchType === 'full') {
        return [
            new StringFilter(""),
            ..._.flatten([
                // Flattened because a filterClass can expand to multiple filter
                // instances, e.g. for saved custom filters
                new suggestion.filterClass(updatedText.trim())
            ]),
            ...filterSet.slice(1)
        ];
    } else {
        return [
            new StringFilter(updatedText),
            ...filterSet.slice(1)
        ];
    }
}

export interface CustomFilterClass extends FilterClass {
    isCustomFilter: true;
    filterName: string;
}

export function buildCustomFilter(
    name: string, // A name for your custom filter
    filterString: string, // The full filter string it expands to
    availableFilters: FilterClass[] // Parsed in the context of this set of filter classes
): CustomFilterClass {
    const parsedFilters = matchFilters(availableFilters, filterString);

    // Skip empty string filters
    const filtersToInsert = parsedFilters[0].filter === ''
        ? parsedFilters.slice(1)
        : parsedFilters; // Only include the string filter if it's non-empty

    // Build a fake constructor that produces the filters within, rather than
    // building a filter by itself as normal.
    const factory = (function () { return filtersToInsert; }) as unknown as (new () => Filters);
    return Object.assign(factory, {
        filterSyntax: [new FixedStringSyntax(name)],
        filterDescription: () => filterString,

        filterName: name,
        isCustomFilter: true
    } as const);
};

export function isCustomFilter(
    f: FilterClass & { isCustomFilter?: boolean }
): f is CustomFilterClass {
    return !!f.isCustomFilter;
}