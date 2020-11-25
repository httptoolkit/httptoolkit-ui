import * as _ from 'lodash';

export type SyntaxMatch = {
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
    match(value: string, index: number): undefined | SyntaxMatch;

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

type CharRange = readonly [number, number];

export function charRange(charA: string, charB?: string): CharRange {
    if (charB) {
        return [charA.charCodeAt(0), charB.charCodeAt(0)];
    } else {
        return [charA.charCodeAt(0), charA.charCodeAt(0)];
    }
}

function matchesRange(charCode: number, range: CharRange) {
    return charCode >= range[0] && charCode <= range[1];
}

// Note that our definition of 'number' is very simplistic: no decimal points,
// no thousand separators, no negative numbers, just 0+ integers.
const getNumberAt = (value: string, index: number) =>
    getStringAt(value, index, [NUMBER_CHARS]);

/**
 * Match a string at a given position, allowing only characters from
 * the given range
 */
function getStringAt(value: string, index: number, allowedCharRanges: CharRange[]) {
    let i: number;

    // Keep reading chars until we either hit the end of the
    // string (maybe immediately) or hit an invalid character
    for (i = index; i < value.length; i++) {
        const nextChar = value.charCodeAt(i);
        if (!_.some(allowedCharRanges, r => matchesRange(nextChar, r))) break;
    }

    if (i !== index) {
        // We found at least one character, that's a match:
        return value.substring(index, i);
    } else if (i === value.length) {
        // We were at the end of the string, that's an empty partial match:
        return "";
    } else {
        // We found no characters, and no end of string: fail
        return undefined;
    }
}

const NUMBER_CHARS = [48, 57] as const; // 0-9 ascii codes

function getParsedValue(part: SyntaxPart, value: string, index: number): string {
    const match = part.match(value, index);
    if (!match || match.type !== 'full') {
        console.log("Unparseable expected-parseable input", value);
        throw new Error("Can't parse expected-parseable value");
    }
    return value.slice(index, index + match.consumed);
}

function filterContextualSuggestions<S>(
    value: string,
    index: number,
    context: S | undefined,
    existingInput: string | undefined,
    suggestionGenerator: ((value: string, index: number, context: S) => string[]) | undefined,
    filter: (suggestion: string) => boolean
): Suggestion[] {
    if (!context || !suggestionGenerator) return [];

    const lowercaseInput = (existingInput || '').toLowerCase();
    return suggestionGenerator(value, index, context)
        .filter((suggestion) =>
            (
                !lowercaseInput ||
                suggestion.toLowerCase().startsWith(lowercaseInput)
            ) && filter
        )
        .slice(0, 10) // Max 10 results
        .map(s => ({
            showAs: s,
            value: s,
            matchType: 'full'
        }));
}

export class FixedStringSyntax implements SyntaxPart<string> {

    constructor(
        private matcher: string
    ) {}

    match(value: string, index: number): undefined | SyntaxMatch {
        const expected = this.matcher.toLowerCase();
        let i: number;

        // Compare char by char over the common size
        for (i = index; (i - index) < this.matcher.length && i < value.length; i++) {
            if (expected[i - index] !== value[i].toLowerCase()) return undefined;
        }

        const consumedChars = i - index;

        // We ran out of a string without a mismatch. Which?
        return {
            type: (consumedChars === this.matcher.length)
                ? 'full'
                : 'partial',
            consumed: consumedChars
        };
    }

    getSuggestions(value: string, index: number): Suggestion[] {
        return [{
            showAs: this.matcher,
            value: this.matcher,
            matchType: 'full'
        }];
    }

    parse(value: string, index: number): string {
        // Ensure the parsing matches correctly
        getParsedValue(this, value, index);
        // Return the expected string (ignoring input case) not the matched text:
        return this.matcher;
    }

}

export class StringSyntax<C = never> implements SyntaxPart<string, C> {

    static AnyAsciiExceptSpaces = [charRange('!', '~')];

    private allowedCharRanges: CharRange[];
    private allowEmpty: (value: string, index: number) => boolean;

    constructor(
        private templateText: string,
        private options: {
            allowEmpty?: (value: string, index: number) => boolean,
            allowedChars?: CharRange[],
            suggestionGenerator?: (value: string, index: number, context: C) => string[]
        } = {}
    ) {
        this.allowedCharRanges = options.allowedChars ||
            StringSyntax.AnyAsciiExceptSpaces;
        this.allowEmpty = options.allowEmpty || (() => false);
    }

    match(value: string, index: number): undefined | SyntaxMatch {
        const matchingString = getStringAt(value, index, this.allowedCharRanges);
        if (matchingString === undefined) return;

        const consumedChars = matchingString.length;

        // Any string is a full match, any empty space is a potential string
        return {
            type: (consumedChars > 0 || this.allowEmpty(value, index))
                ? 'full'
                : 'partial',
            consumed: consumedChars
        };
    }

    getSuggestions(value: string, index: number, context?: C): Suggestion[] {
        const matchingString = getStringAt(value, index, this.allowedCharRanges);

        const suggestions = filterContextualSuggestions(value, index, context,
            matchingString,
            this.options.suggestionGenerator,
            (suggestion) =>
                // Suggestion chars must match one of the given char ranges
                ![...suggestion].map(c => c.charCodeAt(0)).some(c =>
                    !this.allowedCharRanges.some(r => matchesRange(c, r))
                )
        );

        if (!matchingString) {
            return [
                {
                    showAs: `{${this.templateText}}`,
                    value: "",
                    matchType: 'template'
                },
                ...(this.allowEmpty(value, index) && matchingString === ""
                    ? [{
                        showAs: '',
                        value: '',
                        matchType: 'full'
                    } as const]
                    : []
                ),
                ...suggestions
            ];
        } else {
            return [{
                showAs: matchingString,
                value: matchingString,
                matchType: 'full'
            }, ...suggestions];
        }
    }

    parse(value: string, index: number): string {
        return getParsedValue(this, value, index);
    }

}

export class NumberSyntax implements SyntaxPart<number> {

    private stringSyntax: StringSyntax;

    constructor(name: string = "number") {
        this.stringSyntax = new StringSyntax(name, { allowedChars: [NUMBER_CHARS] });
    }

    match(value: string, index: number): SyntaxMatch | undefined {
        return this.stringSyntax.match(value, index);
    }

    getSuggestions(value: string, index: number): Suggestion[] {
        return this.stringSyntax.getSuggestions(value, index);
    }

    parse(value: string, index: number): number {
        const valueAsString = this.stringSyntax.parse(value, index);
        return parseInt(valueAsString, 10);
    }

}

export class FixedLengthNumberSyntax<S> implements SyntaxPart<number, S> {

    constructor(
        private requiredLength: number,
        private options: {
            suggestionGenerator?: (value: string, index: number, context: S) => string[]
        } = {}
    ) {}

    match(value: string, index: number): undefined | SyntaxMatch {
        const matchingNumber = getNumberAt(value, index);
        if (matchingNumber === undefined) return;

        const consumedChars = matchingNumber.length;

        if (consumedChars === this.requiredLength) {
            return { type: 'full', consumed: consumedChars };
        } else if (consumedChars < this.requiredLength) {
            return { type: 'partial', consumed: consumedChars };
        } else {
            return undefined; // Too many numbers - not a match
        }
    }

    getSuggestions(value: string, index: number, context?: S): Suggestion[] {
        const matchingNumber = getNumberAt(value, index);

        const suggestions = filterContextualSuggestions(value, index, context,
            matchingNumber,
            this.options.suggestionGenerator,
            (suggestion) =>
                // Suggestions must have the right length
                suggestion.length === this.requiredLength &&
                // and be numbers
                ![...suggestion].map(c => c.charCodeAt(0)).some(c =>
                    !matchesRange(c, NUMBER_CHARS)
                )
        );

        if (!matchingNumber) {
            return [{
                showAs: `{${this.requiredLength}-digit number}`,
                value: "",
                matchType: 'template'
            }, ...suggestions];
        } else if (suggestions.length) {
            // If we have any suggestions, they're valid suffixes of the entered
            // value, and so they're better suggestions than just extending
            // the number with 00s, so use them directly
            return suggestions;
        } else {
            // Otherwise, extend to the required length with 00s.
            const extendedNumber = matchingNumber +
                _.repeat("0", this.requiredLength - matchingNumber.length);

            return [{
                showAs: extendedNumber,
                value: extendedNumber,
                matchType: 'full'
            }];
        }
    }

    parse(value: string, index: number): number {
        const valueAsString = getParsedValue(this, value, index);
        return parseInt(valueAsString, 10);
    }

}

export class StringOptionsSyntax<OptionsType extends string = string> implements SyntaxPart<OptionsType> {

    private optionMatchers: FixedStringSyntax[];

    constructor(
        options: Array<OptionsType>
    ) {
        this.optionMatchers = options.map(s => new FixedStringSyntax(s));
    }

    match(value: string, index: number): SyntaxMatch | undefined {
        const matches = this.optionMatchers
            .map(m => m.match(value, index))
            .filter(m => !!m);

        const [fullMatches, partialMatches] = _.partition(matches, { type: 'full' });

        const bestMatches = fullMatches.length ? fullMatches : partialMatches;
        return _.maxBy(bestMatches, (m) => m?.consumed); // The longest best matching option
    }

    getSuggestions(value: string, index: number): Suggestion[] {
        let matchers = this.optionMatchers
            .map(m => ({ matcher: m, match: m.match(value, index) }))
            .filter(({ match }) => !!match);

        // If there's an exact match (should only ever be one), suggest only that:
        if (matchers.some(({ match }) => match!.type === 'full')) {
            matchers = matchers.filter(({ match }) => match!.type === 'full');
        }

        return _.flatMap(matchers, ({ matcher }) =>
            matcher.getSuggestions(value, index)
        );
    }

    parse(value: string, index: number): OptionsType {
        return getParsedValue(this, value, index) as OptionsType;
    }

}

/**
 * Matches a chunk of syntax, but also matches fully if that syntax does not
 * appear. In effect, this always matches. Either it fully matches nothing
 * if there's mismatch, it partially matches if it's a partial match at the
 * end of the string (but only there), or it fully matches if some
 * fully matching content for all parts within is present.
 */
export class OptionalSyntax<
    Ps extends unknown[] = unknown[],
    C = never,
    SPs extends { [i in keyof Ps]: SyntaxPart<Ps[i], C> }
        = { [i in keyof Ps]: SyntaxPart<Ps[i], C> }
> implements SyntaxPart<Ps | [], C> {

    private subParts: SPs;

    constructor(...subParts: SPs) {
        this.subParts = subParts; // Apparently ... isn't allowed in field params.
    }

    match(value: string, index: number): SyntaxMatch | undefined {
        let currentIndex = index;

        if (currentIndex >= value.length) {
            return { type: 'full', consumed: 0 };
        }

        for (const subPart of this.subParts) {
            const nextMatch = subPart.match(value, currentIndex);

            if (!nextMatch) {
                return { type: 'full', consumed: 0 };
            }

            currentIndex += nextMatch.consumed;

            if (nextMatch.type === 'partial') {
                if (currentIndex === value.length) {
                    return { type: 'partial', consumed: currentIndex - index };
                } else {
                    return { type: 'full', consumed: 0 };
                }
            }
        }

        return { type: 'full', consumed: currentIndex - index };
    }

    getSuggestions(value: string, index: number, context?: C): Suggestion[] {
        const isEndOfValue = value.length === index;
        let currentIndex = index;
        let suggestions: Suggestion[] = [{
            showAs: "",
            value: "",
            matchType: 'full'
        }];
        let matchedAllParts = false;

        for (const subPart of this.subParts) {
            const nextMatch = subPart.match(value, currentIndex);

            // If there's any part that doesn't match at all, we suggest skipping
            // this optional part entirely. This effectively allows backtracking for
            // suggestions, so the suggestion is shown only if the next non-optional
            // part _does_ match this content correctly.
            if (!nextMatch) return [{ showAs: "", value: "", matchType: 'full' }];
            matchedAllParts = subPart === this.subParts[this.subParts.length - 1];

            const nextSuggestions = subPart.getSuggestions(value, currentIndex, context);

            suggestions = _.flatMap(suggestions, (suggestion) =>
                nextSuggestions.map((nextSuggestion) => ({
                    showAs: suggestion.showAs + nextSuggestion.showAs,
                    value: suggestion.value + nextSuggestion.value,
                    matchType: nextSuggestion.matchType
                }))
            );

            if (
                suggestions.some(s => s.matchType !== 'full') ||
                suggestions.length !== 1 // We only expand until the first >1 split
            ) break;

            // Otherwise, just keep on appending suggestions
            currentIndex += nextMatch.consumed;
        }

        if (!matchedAllParts) {
            // Not a full match for the whole part if all sub-parts weren't matched
            suggestions = suggestions.map((suggestion) => ({
                ...suggestion,
                matchType: suggestion.matchType === 'full'
                    ? 'partial'
                    : suggestion.matchType
            }));
        }

        if (isEndOfValue) {
            return [
                { showAs: "", value: "", matchType: 'full' },
                ...suggestions
            ];
        } else {
            return suggestions;
        }
    }

    parse(value: string, index: number): Ps | [] {
        const match = this.match(value, index);
        if (!match || match.consumed === 0) return [];

        // Parse implies a full match, and now know it's not empty, so we must
        // have a full match for every part. Loop through, return them as an array.
        return _.reduce(this.subParts, (parsed: Ps[], part: SyntaxPart<any>) => {
            const parsedValue = part.parse(value, index);
            index += parsedValue.toString().length;
            parsed.push(parsedValue as any);
            return parsed;
        }, []) as Ps;
    }
}