import * as _ from 'lodash';

export interface SyntaxPart<PartValue = string | number, Context extends any = never> {
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
    getSuggestions(value: string, index: number, context?: Context): SyntaxSuggestion[];

    /**
     * For a part that fully matches, this will return the fully matched
     * content in a content-appropriate type, e.g. strings for strings,
     * numbers for numbers.
     *
     * If the part does not fully match, this throws an error.
     */
    parse(value: string, index: number): PartValue;
};

// The value a syntax part will return when parsed
export type SyntaxPartValue<SP> = SP extends SyntaxPart<infer V> ? V : never;
// The values that an array of syntax parts will return
export type SyntaxPartValues<SPs extends readonly SyntaxPart<any, any>[]> = {
    [i in keyof SPs]: SyntaxPartValue<SPs[i]>
};

// The context a syntax part would like to generate suggestions
export type SyntaxPartContext<SP> = SP extends SyntaxPart<any, infer C> ? C : never;

/**
 * A suggestion for some content to insert to complete a single part
 * of syntax.
 *
 * Syntax suggestions may be concatenated, by simply concatenating their showAs
 * and value strings directly.
 */
export interface SyntaxSuggestion {
    /**
     * The text that should show as the autocompleted example
     */
    showAs: string;

    /**
     * The position at which this suggestion should be placed in the
     * input text.
     *
     * For single part suggestions, this is usually trivial: it's the
     * index that was passed to getSuggestions, where they start matching.
     * For multi-part suggestions though it can be more complicated in
     * some cases.
     */
    index: number;

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
    syntax: readonly SyntaxPart<unknown, unknown>[],
    value: string,
    initialIndex: number
): SyntaxMatch | undefined {
    let stringIndex = initialIndex;
    let fullyConsumed = 0;
    let syntaxIndex: number;
    let wasFullMatch = true;

    let lastConsumingPartSyntaxIndex = 0;
    let lastConsumingPartStringIndex = initialIndex;

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

/**
 * Takes a full string, and given a list of syntax parts, returns an
 * appropriate list of suggestions to show the user.
 *
 * Syntax part inputs are linked to a key, so that you can conveniently
 * work out which input created with suggestion later on.
 *
 * Optionally also takes context, which may be used by some syntax
 * parts to provide more specific context-driven suggestions.
 */
 export function getSuggestions<C, K = unknown>(
    syntaxOptions: Array<{ key: K, syntax: readonly SyntaxPart<any, C>[] }>,
    value: string,
    initialIndex: number,
    options: {
        context: C,
        canExtend?: boolean
    }
): Array<{ key: K, suggestion: SyntaxSuggestion }> {
    const syntaxMatches = syntaxOptions.map(({ key: key, syntax }) => ({
        key,
        syntax,
        match: matchSyntax(syntax, value, initialIndex)
    })).filter(({ match }) => {
        // We only show suggestions for syntax that does/might match, and which matches
        // the whole of the input - so "status=40" suggests 404, but "status=hello" shows
        // nothing (it doesn't suggest 404 at the start of hello).
        // Maybe later we could show suggestions in such cases given a space separator?
        return !!match && (initialIndex + match.partiallyConsumed) === value.length
    });

    const [fullMatches, partialMatches] = _.partition(syntaxMatches, ({ match }) =>
        match!.type === 'full'
    );

    if (fullMatches.length) {
        // If we have full matches (what you've typed fully matches a syntax option) then
        // we should rematch just the final part, to get a final completion suggestion.
        // E.g. Given status=404, we want a suggestion for just '404' after the =.
        return _.flatMap(fullMatches, ({ key, syntax, match }) => {
            const finalSyntaxIndex = syntax.length - 1;
            const didLastPartConsumeChars = finalSyntaxIndex === match!.lastConsumingPartSyntaxIndex;

            const stringIndex = didLastPartConsumeChars
                // If last consuming part is the last part, then we rerun that in the same place
                // to get a final suggestion for the whole set of syntax.
                ? match!.lastConsumingPartStringIndex
                // If last consuming part is not the last part, there must be final full-matching
                // but zero-consuming part(s), like an optional suffix. We want to rerun the last
                // part but in that case we just rerun it at the very end of the string.
                : value.length;

            return syntax[finalSyntaxIndex]
                .getSuggestions(value, stringIndex, options.context)
                .map((suggestion) => ({
                    key,
                    suggestion
                }));
        });
    }

    // Otherwise, we're looking at partial matches. Let's find the best ones:
    const maxMatchedParts = _.max(
        partialMatches.map(({ match }) => match!.partsMatched)
    );

    const bestPartialMatches = partialMatches.filter(m =>
        m.match!.partsMatched === maxMatchedParts
    );

    // We have some syntax that partially matches. For each set of syntax, get the next suggestions
    // that should be offered to extend (and _maybe_ complete) a match.
    const suggestionsWithMatches = _.flatMap(bestPartialMatches, ({
        key, syntax, match
    }) => {
        // We want to get suggestions from the last part that consumed any input. That means
        // for a last-part half-match, we want that partial last part, but for a last part
        // 0-char-match, we want the preceding full part, because there might still be
        // useful suggestions there to extend that part.
        const syntaxPartIndex = match!.lastConsumingPartSyntaxIndex;
        const stringIndex = match!.lastConsumingPartStringIndex;

        // For partially matched syntax, partsMatched is always the index+1
        // of partially matched part (the part we're waiting to complete)
        const nextPartToMatch = syntax[syntaxPartIndex];
        const isLastPart = syntaxPartIndex === syntax.length - 1;

        return nextPartToMatch.getSuggestions(value, stringIndex, options.context)
            .map((suggestion) => ({
                key,
                syntax,
                syntaxPartIndex,
                suggestion: {
                    ...suggestion,
                    matchType: (
                        suggestion.matchType === 'full'
                        ? (isLastPart ? 'full' : 'partial')
                        : suggestion.matchType
                    ) as 'full' | 'template' | 'partial'
                }
            }));
    });

    // If we have multiple suggestions at this stage, we're done. Return those
    // as the options to show the user.
    if (suggestionsWithMatches.length !== 1 || options.canExtend === false) {
        return suggestionsWithMatches.map(({ key, suggestion }) => ({
            key,
            suggestion
        }));
    }

    // If we have exactly one option, we should try to keep extending it, to
    // provide more interesting options by making more jumps in one go.

    const { key, syntax, suggestion: originalSuggestion } = suggestionsWithMatches[0];
    let syntaxPartIndex = suggestionsWithMatches[0].syntaxPartIndex + 1;

    // Iteratively expand the suggestion to include future parts, if possible, until we
    // have either >1 option or a template option:
    let suggestions = [originalSuggestion];

    // If we've reached a template suggestion, this is the template that we'll eventually
    // return. We keep looping a little further just to nicely complete the showAs.
    let sawTemplate: SyntaxSuggestion | undefined;

    while (suggestions.length === 1 && syntaxPartIndex < syntax.length) {
        const singleSuggestion = suggestions[0];
        sawTemplate ||= singleSuggestion.matchType === 'template'
            ? singleSuggestion
            : undefined;

        const updatedText = applySuggestionToText(value, singleSuggestion);

        const nextSuggestions = syntax[syntaxPartIndex]
            .getSuggestions(updatedText, updatedText.length, options.context);

        // After we hit a template we keep collecting suggestions until they're ambiguous
        if (sawTemplate && nextSuggestions.length > 1) break;

        suggestions = nextSuggestions.map((nextSuggestion) => ({
            value: singleSuggestion.value + nextSuggestion.value,
            showAs: singleSuggestion.showAs + nextSuggestion.showAs,
            index: singleSuggestion.index,
            matchType: nextSuggestion.matchType
        }));

        // We never extend partial suggestions - partial means user input will be required
        if (suggestions.some(s => s.matchType === 'partial')) break;

        syntaxPartIndex += 1;
    }

    const matchedAllParts = syntaxPartIndex === syntax.length;

    if (!sawTemplate) {
        return suggestions.map((suggestion) => ({
            key,
            suggestion: {
                ...suggestion,
                matchType: suggestion.matchType === 'full' && !matchedAllParts
                    // Not a full *filter* match if all parts weren't matched
                    ? 'partial'
                    : suggestion.matchType
            }
        }));
    } else {
        return [{
            key: key,
            suggestion: {
                ...sawTemplate,
                showAs: suggestions[0].showAs
            }
        }];
    }
}

export function applySuggestionToText(value: string, suggestion: SyntaxSuggestion) {
    return value.slice(0, suggestion.index) + suggestion.value;
}