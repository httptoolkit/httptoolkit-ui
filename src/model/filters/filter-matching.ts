import * as _ from 'lodash';

import { FilterClass, Filters, FilterSet, StringFilter } from './search-filters';
import { FixedStringSyntax, Suggestion } from './syntax-parts';

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
                match: matchFilter(filterClass, remainingString)
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

type FilterMatch = {
    /**
     * If full, this filter completely matches the text shown.
     * If partial, this filter could match, iff more content was appended.
     *
     * Note that the exact end of the string should be a partial match for all
     * filtesr, since you should always be able to append content to match there.
     */
    type: 'partial' | 'full';

    /**
     * The number of characters fully matched by completed parts of the
     * filter's syntax.
     */
    fullyConsumed: number;

    /**
     * The number of characters fully or partially matched by parts of the
     * filter's syntax.
     */
    partiallyConsumed: number;

    /**
     * For full matches, this = the total number of parts available.
     * For partial matches, this-1 is the index of the partially matched part.
     */
    partsMatched: number;

    /**
     * For full matches, the string index at the start of the last part.
     * For partial matches, the string index at the start of the partially
     * matching part (i.e. the last *matched* part, not the last part overall)
     */
    lastPartStringIndex: number;
};

function matchFilter(filter: FilterClass, value: string): undefined | FilterMatch {
    const syntax = filter.filterSyntax;

    let stringIndex = 0;
    let fullyConsumed = 0;
    let syntaxIndex: number;
    let wasFullMatch = true;
    let lastPartStringIndex = 0;

    for (
        syntaxIndex = 0;
        syntaxIndex < syntax.length && stringIndex <= value.length && wasFullMatch;
        syntaxIndex++
    ) {
        lastPartStringIndex = stringIndex;
        const partMatch = syntax[syntaxIndex].match(value, stringIndex);
        if (!partMatch) return;

        wasFullMatch = partMatch.type === 'full';

        stringIndex += partMatch.consumed;
        fullyConsumed += wasFullMatch ? partMatch.consumed : 0;
    }

    return {
        type: syntaxIndex === syntax.length && wasFullMatch
            ? 'full'
            : 'partial',
        fullyConsumed,
        partiallyConsumed: stringIndex,
        partsMatched: syntaxIndex,
        lastPartStringIndex
    };
}

export interface FilterSuggestion extends Suggestion {
    index: number;
    filterClass: FilterClass;
};

/**
 * Takes a full string, and given a list of filters, returns an
 * appropriate list of suggestions to show the user.
 *
 * Optionally also takes context, which may be used by some syntax
 * parts to provide more specific context-driven suggestions.
 */
export function getSuggestions<T>(
    filters: FilterClass<T>[],
    value: string,
    context?: T
): FilterSuggestion[] {
    const filterMatches = filters.map(f => ({
        filterClass: f,
        match: matchFilter(f, value)
    })).filter(fm => {
        // We only show suggestions for filters that do/might match, and which fully
        // match - so "status=40" suggests 404, but "status=hello" shows nothing.
        // Maybe later we could show suggestions, but only given a space separator?
        return !!fm.match &&
            fm.match.partiallyConsumed === value.length
    });

    const [fullMatches, partialMatches] = _.partition(filterMatches, ({ match }) =>
        match!.type === 'full'
    );

    if (fullMatches.length) {
        // If we have full matches (what you've typed fully matches an existing suggestion)
        // then we should only show that/those suggestion(s).
        return _.flatMap(fullMatches, ({ filterClass, match }) => {
            const stringIndex = match!.lastPartStringIndex;
            const syntaxIndex = filterClass.filterSyntax.length - 1;

            // Filters may return full-matching prefix suggestions, but if we're
            // fully matching a string, we only want exact right-to-the-end matches
            const expectedSuggestionLength = value.length - stringIndex;

            return filterClass.filterSyntax[syntaxIndex]
                .getSuggestions(value, stringIndex, context)
                .filter((suggestion) =>
                    suggestion.value.length === expectedSuggestionLength
                )
                .map((suggestion) => ({
                    ...suggestion,
                    filterClass,
                    index: stringIndex
                }));
        })
    }

    const maxMatchedParts = _.max(
        partialMatches.map(({ match }) => match!.partsMatched)
    );

    const bestPartialMatches = partialMatches.filter(m =>
        m.match!.partsMatched === maxMatchedParts
    );

    // We have some filters that partially match. For each, get the next suggestions that
    // should be offered to extend (and _maybe_ complete) the match.
    const suggestionsWithMatches = _.flatMap(bestPartialMatches, ({ filterClass, match }) => {
        const syntaxPartIndex = match!.partsMatched - 1;
        const stringIndex = match!.fullyConsumed;
        // For partially matched filters, partsMatched is always the index+1
        // of partially matched part (the part we're waiting to complete)
        const nextPartToMatch = filterClass.filterSyntax[syntaxPartIndex];
        const isLastPart = syntaxPartIndex === filterClass.filterSyntax.length - 1;

        return nextPartToMatch.getSuggestions(value, stringIndex, context)
            .map((suggestion) => ({
                suggestion: {
                    ...suggestion,
                    filterClass,
                    index: stringIndex,
                    matchType: (suggestion.matchType === 'full'
                        ? (isLastPart ? 'full' : 'partial')
                        : suggestion.matchType
                    ) as 'full' | 'template' | 'partial'
                },
                filterClass,
                match
            }));
    });

    if (suggestionsWithMatches.length !== 1) {
        return suggestionsWithMatches.map(({ suggestion }) => suggestion);
    }

    const { filterClass, match, suggestion: originalSuggestion } = suggestionsWithMatches[0];

    // Iteratively expand the suggestion to include future parts, if possible, until we
    // have either >1 option or a template option:
    let suggestions = [originalSuggestion];
    let syntaxPartIndex = match!.partsMatched; // Without -1, i.e. the next part we would match

    // If we've reached a template suggestion, this is the template that we'll eventually
    // return. We keep looping a little further just to nicely complete the showAs.
    let sawTemplate: FilterSuggestion | undefined;

    while (suggestions.length === 1 && syntaxPartIndex < filterClass.filterSyntax.length) {
        const singleSuggestion = suggestions[0];
        sawTemplate ||= singleSuggestion.matchType === 'template'
            ? singleSuggestion
            : undefined;

        const updatedText = applySuggestionToText(value, singleSuggestion);

        const nextSuggestions = filterClass.filterSyntax[syntaxPartIndex]
            .getSuggestions(updatedText, updatedText.length, context);

        // After we hit a template we keep collecting suggestions until they're ambiguous
        if (sawTemplate && nextSuggestions.length > 1) break;

        suggestions = nextSuggestions.map((nextSuggestion) => ({
            value: singleSuggestion.value + nextSuggestion.value,
            showAs: singleSuggestion.showAs + nextSuggestion.showAs,
            filterClass,
            index: singleSuggestion.index,
            matchType: nextSuggestion.matchType
        }));

        // We never extend partial suggestions - partial means user input will be required
        if (suggestions.some(s => s.matchType === 'partial')) break;

        syntaxPartIndex += 1;
    }

    const matchedAllParts = syntaxPartIndex === filterClass.filterSyntax.length;

    if (!sawTemplate) {
        return suggestions.map((suggestion) => ({
            ...suggestion,
            matchType: suggestion.matchType === 'full' && !matchedAllParts
                // Not a full *filter* match if all parts weren't matched
                ? 'partial'
                : suggestion.matchType
        }));
    } else {
        return [{
            ...sawTemplate,
            showAs: suggestions[0].showAs
        }];
    }
}

export function applySuggestionToText(value: string, suggestion: FilterSuggestion) {
    return value.slice(0, suggestion.index) + suggestion.value;
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