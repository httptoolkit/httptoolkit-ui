

/**
 * A suggestion for some content to insert. This is fleshed out further by
 * getSuggestions in filter-matching, once a filter & full string are
 * being applied.
 *
 * Suggestions may be concatenated, by simply concatenating their showAs
 * and value strings directly.
 */
export interface Suggestion {
    /**
     * The text that should show as the autocompleted example
     */
    showAs: string;

    /**
     * The text that should actually insert if you select the example.
     *
     * If this is not a template suggestion, then inserting the suggestion
     * must result in a string that fully matches this syntax part.
     */
    value: string;

    /**
     * The type of match that this suggestion would create.
     *
     * 'full' means that applying this suggestion to the given input will
     * create a value that would fully match the input.
     *
     * 'template' and 'partial' both mean that this wouldn't fully match
     * the input, in slightly different ways.
     *
     * 'template' means that this wouldn't fully match the input, but the showAs
     * value will be a placeholder. User input would be required, but suggestion
     * values could be appended to showAs to provide context.
     *
     * 'partial' means that this wouldn't fully match the input, and the
     * showAs property would also be incomplete, so no further suggestions
     * should be appended - we'd need to stop and prompt the user first.
     *
     * Either way, all suggestions are recommendations that the user could
     * sensibly apply, it's just that template/partial suggestions require
     * further input on this specific part before the syntax part is matched.
     */
    matchType: 'full' | 'template' | 'partial';
}

export interface SyntaxPart<P = string | number, C extends any = never> {
    /**
     * Checks whether the syntax part matches, or _could_ match if
     * some text were appended to the string.
     *
     * This will return undefined if the value could not match, e.g.
     * a number is required and there's a non-number entered already.
     * If will return a full match if the part is completely present,
     * and will consume everything it can, and it will return a partial
     * match if the end of the string was reached without breaking any
     * rules, but without successfully completing the matcher.
     */
    match(value: string, index: number): undefined | SyntaxPartMatch;

    /**
     * Given that there was a full or partial match, this returns a list of
     * possible values that would make this syntax part match fully.
     *
     * Don't call it without a match, as the behaviour is undefined.
     */
    getSuggestions(value: string, index: number, context?: C): Suggestion[];

    /**
     * For a part that fully matches, this will return the fully matched
     * content in a content-appropriate type, e.g. strings for strings,
     * numbers for numbers.
     *
     * If the part does not fully match, this throws an error.
     */
    parse(value: string, index: number): P;
};

export type SyntaxPartValue<P> = P extends SyntaxPart<infer V> ? V : never;

/**
 * The result of matching a single syntax part within a string
 */
export type SyntaxPartMatch = {
    /**
     * If full, this part was completely matched and would be valid as-is
     * If partial, this part could become valid, iff more content was appended
     *
     * Note that the exact end of the string should be a partial match for all
     * syntax parts, since you should always be able to append content to match
     * that part.
     */
    type: 'partial' | 'full';

    /**
     * How many characters were matched successfully.
     */
    consumed: number;
};

/**
 * The result of matching an array of syntax parts against a string.
 */
 export type SyntaxMatch = {
    /**
     * If full, this syntax completely matches the text shown.
     * If partial, this syntax could match, iff more content was appended.
     *
     * Note that the exact end of the string should be a partial match for any
     * syntax, since you should always be able to append content to match there.
     */
    type: 'partial' | 'full';

    /**
     * The number of characters fully matched by completed parts of the syntax.
     */
    fullyConsumed: number;

    /**
     * The number of characters fully or partially matched by parts of the syntax.
     */
    partiallyConsumed: number;

    /**
     * For full matches, this = the total number of parts available.
     * For partial matches, this-1 is the index of the partially matched part.
     */
    partsMatched: number;

    /**
     * The index of the last syntax part that consumed >0 characters. In effect,
     * this is the work-in-progress part: it's the first part that should be
     * allowed to make suggestions.
     */
    lastConsumingPartSyntaxIndex: number;

    /**
     * The string index to the latest work-in-progress part of the input.
     *
     * For full matches, the string index at the start of the last part.
     * For partial matches, the string index at the start of the full or partially
     * matching part (i.e. the last *matched* part, not the last part overall),
     * iff it matched more than 0 chars.
     */
    lastConsumingPartStringIndex: number;
};



// ^ That's all the core types, defining the syntax structure
// -----------------------------------------------------------------------------------------
// v This is all the generic syntax parsing & matching logic that uses it



/**
 * Match a series of syntax parts at a position in a string. This tests each part, stepping
 * through the consumed string as it's matched, and returning full/partial according to
 * the final match, with details of how much of the string & syntax was matched en route.
 */
 export function matchSyntax(
    syntax: readonly SyntaxPart[],
    value: string,
    initialIndex = 0
): SyntaxMatch | undefined {
    let stringIndex = initialIndex;
    let fullyConsumed = 0;
    let syntaxIndex: number;
    let wasFullMatch = true;

    let lastConsumingPartSyntaxIndex = 0;
    let lastConsumingPartStringIndex = 0;

    for (
        syntaxIndex = 0;
        syntaxIndex < syntax.length && stringIndex <= value.length && wasFullMatch;
        syntaxIndex++
    ) {
        const partMatch = syntax[syntaxIndex].match(value, stringIndex);
        if (!partMatch) return;

        wasFullMatch = partMatch.type === 'full';

        if (partMatch.consumed > 0) {
            lastConsumingPartSyntaxIndex = syntaxIndex;
            lastConsumingPartStringIndex = stringIndex;
        }

        stringIndex += partMatch.consumed;
        fullyConsumed += wasFullMatch ? partMatch.consumed : 0;
    }

    return {
        type: syntaxIndex === syntax.length && wasFullMatch
            ? 'full'
            : 'partial',
        fullyConsumed,
        partiallyConsumed: stringIndex - initialIndex,
        partsMatched: syntaxIndex,
        lastConsumingPartSyntaxIndex,
        lastConsumingPartStringIndex
    };
}