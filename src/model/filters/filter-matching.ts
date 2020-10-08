import { FilterClass, FilterSet, StringFilter } from './search-filters';
import { SyntaxMatch } from './syntax-parts';

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

        const consumed = firstFullMatch.match!.consumed;
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

function matchFilter(filter: FilterClass, value: string): undefined | SyntaxMatch {
    const syntax = filter.filterSyntax;

    let stringIndex = 0;
    let syntaxIndex: number;
    let wasPartialMatch = false;

    for (
        syntaxIndex = 0;
        syntaxIndex < syntax.length && stringIndex < value.length;
        syntaxIndex++
    ) {
        const partMatch = syntax[syntaxIndex].match(value, stringIndex);
        if (!partMatch) return;

        stringIndex += partMatch.consumed;
        wasPartialMatch = partMatch.type === 'partial';
    }

    return {
        type: syntaxIndex === syntax.length && !wasPartialMatch
            ? 'full'
            : 'partial',
        consumed: stringIndex
    };
}