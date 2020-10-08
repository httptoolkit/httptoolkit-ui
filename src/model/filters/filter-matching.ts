import * as _ from 'lodash';

import { FilterClass, FilterSet, StringFilter } from './search-filters';
import { Suggestion } from './syntax-parts';

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
        ...filters
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
};

function matchFilter(filter: FilterClass, value: string): undefined | FilterMatch {
    const syntax = filter.filterSyntax;

    let stringIndex = 0;
    let fullyConsumed = 0;
    let syntaxIndex: number;
    let wasPartialMatch = false;

    for (
        syntaxIndex = 0;
        syntaxIndex < syntax.length && stringIndex <= value.length && !wasPartialMatch;
        syntaxIndex++
    ) {
        const partMatch = syntax[syntaxIndex].match(value, stringIndex);
        if (!partMatch) return;

        wasPartialMatch = partMatch.type === 'partial';

        stringIndex += partMatch.consumed;
        fullyConsumed += wasPartialMatch ? 0 : partMatch.consumed;
    }

    return {
        type: syntaxIndex === syntax.length && !wasPartialMatch
            ? 'full'
            : 'partial',
        fullyConsumed,
        partiallyConsumed: stringIndex,
        partsMatched: syntaxIndex
    };
}

type FilterSuggestion = Suggestion & {
    index: number,
    filterClass: FilterClass
};

/**
 * Takes a full string, and given a list of filters, returns an
 * appropriate list of suggestions to show the user.
 */
export function getSuggestions(filters: FilterClass[], value: string): FilterSuggestion[] {
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
        return _.flatMap(fullMatches, ({ filterClass, match }) => {
            const stringIndex = 0;
            const syntaxIndex = filterClass.filterSyntax.length - 1;

            return filterClass.filterSyntax[syntaxIndex]
                .getSuggestions(value, stringIndex)
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

    return _.flatMap(bestPartialMatches, ({ filterClass, match }) => {
        const syntaxPartIndex = match!.partsMatched - 1;
        const stringIndex = match!.fullyConsumed;
        // For partially matched filters, partsMatched is always the index+1
        // of partially matched part (the part we're waiting to complete)
        const nextPartToMatch = filterClass.filterSyntax[syntaxPartIndex];

        return nextPartToMatch.getSuggestions(value, stringIndex)
            .map((suggestion) => ({
                ...suggestion,
                filterClass,
                index: stringIndex
            }));
    });
}