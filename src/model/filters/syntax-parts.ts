import * as _ from 'lodash';

import {
    getSuggestions,
    matchSyntax,
    SyntaxPart,
    SyntaxPartContext,
    SyntaxPartMatch,
    SyntaxPartValue,
    SyntaxSuggestion
} from './syntax-matching';

type CharRange = readonly [number, number];

export function charRange(charA: string, charB?: string): CharRange {
    if (charB) {
        return [charA.charCodeAt(0), charB.charCodeAt(0)];
    } else {
        return [charA.charCodeAt(0), charA.charCodeAt(0)];
    }
}

export const ALPHABETICAL = [charRange("a", "z"), charRange("A", "Z")];
export const NUMERIC = charRange("0", "9");
export const ALPHANUMERIC = [...ALPHABETICAL, NUMERIC];

export function matchesRange(charCode: number, range: CharRange) {
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
): SyntaxSuggestion[] {
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
            index,
            value: s,
            matchType: 'full'
        }));
}

export class FixedStringSyntax<OptionsType extends string = string> implements SyntaxPart<OptionsType> {

    constructor(
        private matcher: OptionsType
    ) {}

    match(value: string, index: number): undefined | SyntaxPartMatch {
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

    getSuggestions(value: string, index: number): SyntaxSuggestion[] {
        return [{
            showAs: this.matcher,
            index,
            value: this.matcher,
            matchType: 'full'
        }];
    }

    parse(value: string, index: number): OptionsType {
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

    match(value: string, index: number): undefined | SyntaxPartMatch {
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

    getSuggestions(value: string, index: number, context?: C): SyntaxSuggestion[] {
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
                    index,
                    value: "",
                    matchType: 'template'
                },
                ...(this.allowEmpty(value, index) && matchingString === ""
                    ? [{
                        showAs: '',
                        index,
                        value: '',
                        matchType: 'full'
                    } as const]
                    : []
                ),
                ...suggestions
            ];
        } else {
            return [
                {
                    showAs: matchingString,
                    index,
                    value: matchingString,
                    matchType: 'full'
                },
                ...suggestions.filter(s => s.value !== matchingString)
            ];
        }
    }

    parse(value: string, index: number): string {
        return getParsedValue(this, value, index);
    }

}

export class SyntaxWrapperSyntax<P> implements SyntaxPart<P> {

    private optional: boolean;

    constructor(
        private wrapper: [start: string, end: string],
        private wrappedSyntax: SyntaxPart<P>,
        options: {
            /**
             * If set, the wrapper is optional, and should only be required & suggested
             * if a input/suggestion contains a space.
             */
            optional?: boolean
        } = {}
    ) {
        this.optional = !!options.optional;
    }

    match(value: string, startIndex: number): SyntaxPartMatch | undefined {
        let isWrapped: boolean;
        let index = startIndex;

        // Check for the wrapper start character first:
        if (value[index] === undefined) {
            return { type: 'partial', consumed: 0 };
        } else if (value[index] === this.wrapper[0]) {
            index += 1;
            isWrapped = true;
        } else if (this.optional) {
            isWrapped = false;
        } else {
            return; // No wrapped, not optional - no match
        }

        // Check the syntax within:
        const endChar = isWrapped ? this.wrapper[1] : ' ';
        const nextEndCharIndex = value.slice(index).indexOf(endChar);
        const valueToMatch = nextEndCharIndex !== -1
            // Don't allow the wrapped syntax to read beyond the wrapper end
            ? value.slice(0, index + nextEndCharIndex)
            : value;

        const submatch = this.wrappedSyntax.match(
            valueToMatch,
            index
        );
        if (!submatch) return;

        index += submatch.consumed;

        if (submatch.type !== 'full') {
            return {
                type: 'partial',
                consumed: index - startIndex
            };
        }

        // Check for the wrapper close character:
        if (isWrapped) {
            if (value[index] === undefined) {
                return { type: 'partial', consumed: index - startIndex };
            } else if (value[index] !== this.wrapper[1]) {
                // Missing closing wrapper after open wrapper - no match
                return;
            } else {
                index += 1;
            }
        }

        return {
            type: 'full',
            consumed: index - startIndex
        };
    }

    getSuggestions(value: string, index: number, context?: never): SyntaxSuggestion[] {
        const hasStartWrapper = value[index] === this.wrapper[0];

        const endChar = !this.optional || hasStartWrapper
            ? this.wrapper[1]
            : ' ';

        // Don't allow the wrapped syntax to include the wrapper end in suggestions:
        const nextEndCharIndex = value.slice(index).indexOf(endChar);
        const valueToMatch = nextEndCharIndex !== -1
            ? value.slice(0, index + nextEndCharIndex)
            : value;

        const wrappedSyntaxStartPosition = hasStartWrapper
            ? index + 1
            : index;

        const suggestionsToWrap = this.wrappedSyntax.getSuggestions(
            valueToMatch,
            wrappedSyntaxStartPosition,
            context
        );

        return suggestionsToWrap.map(suggestion => {
            // Suggestions need a wrapper when it's required or when it's optional but
            // the value would be invalid unwrapped (because it has space)
            const needsWrapper = !this.optional ||
                suggestion.value.includes(' ');

            const shouldAddStartWrapper = needsWrapper && !hasStartWrapper;

            const shouldAddEndWrapper = (needsWrapper || hasStartWrapper) &&
                // We only actually append the end wrapper when the child is totally done
                suggestion.matchType === 'full';
            const valueSuffix = shouldAddEndWrapper ? this.wrapper[1] : '';

            const shouldShowEndWrapper = (needsWrapper || hasStartWrapper) &&
                // We do show the end wrapper for templates though, since it looks nicer
                (suggestion.matchType === 'full' || suggestion.matchType === 'template');
            const shownSuffix = shouldShowEndWrapper ? this.wrapper[1] : '';

            if (!shouldAddStartWrapper) {
                // If the start wrapper is already sorted, we just return the suggestion,
                // maybe with an end wrapper if appropriate
                return {
                    ...suggestion,
                    showAs: suggestion.showAs + shownSuffix,
                    value: suggestion.value + valueSuffix
                };
            } else {
                // If we want a start wrapper, things get more complicated, because we need
                // to backtrack the suggestion, as it might be a suggestion later in the
                // value ('abc', suggest appending ' def' at index 3)
                const extendedValue = this.wrapper[0] + value.slice(
                    wrappedSyntaxStartPosition,
                    suggestion.index
                ) + suggestion.value + valueSuffix;

                const extendedShowAs = this.wrapper[0] + value.slice(
                    wrappedSyntaxStartPosition,
                    suggestion.index
                ) + suggestion.showAs + shownSuffix;

                return {
                    ...suggestion,
                    showAs: extendedShowAs,
                    value: extendedValue,
                    index: wrappedSyntaxStartPosition
                };
            }
        });
    }

    parse(value: string, index: number): P {
        const hasStartWrapper = value[index] === this.wrapper[0];
        const hasEndWrapper = value.slice(index).indexOf(this.wrapper[1]) !== -1;
        const isWrapped = !this.optional || (hasStartWrapper && hasEndWrapper);

        const endChar = isWrapped
            ? this.wrapper[1]
            : ' ';

        // Don't allow the wrapped syntax to read beyond the wrapper end:
        const nextEndCharIndex = value.slice(index).indexOf(endChar);
        const valueToMatch = nextEndCharIndex !== -1
            ? value.slice(0, index + nextEndCharIndex)
            : value;

        return this.wrappedSyntax.parse(
            valueToMatch,
            isWrapped ? index + 1 : index
        );
    }

}

/**
 * Vararg syntax, including a minimum repetitions. This allows you to create
 * syntax like "any number of numbers, separated by a comma". Separators may be
 * followed by any number of spaces, which will be ignored.
 */
export class SyntaxRepeaterSyntax<
    Part extends SyntaxPart<any, any>,
    V extends SyntaxPartValue<Part>,
    C extends SyntaxPartContext<Part>
> implements SyntaxPart<V[], C> {

    private minimumRepetitions: number;
    private placeholderName: string;

    private delimiterSyntax: FixedStringSyntax;

    constructor(
        private delimiterString: string,
        private wrappedSyntax: Part,
        options: {
            minimumRepetitions?: number,
            placeholderName?: string
        } = {}
    ) {
        this.minimumRepetitions = options.minimumRepetitions ?? 2;
        this.placeholderName = options.placeholderName ?? 'value';

        this.delimiterSyntax = new FixedStringSyntax(this.delimiterString);
    }

    // Handles the raw wrapper + delimiter matching, without worrying about
    // minimum repetitions at all.
    private matchSyntaxOnly(
        value: string,
        startIndex: number
    ): (SyntaxPartMatch & { matchCount: number }) {
        const { wrappedSyntax, delimiterString, delimiterSyntax } = this;

        let index = startIndex;
        let matchCount = 0;
        let lastPartMatchEndIndex = 0;

        while (true) {
            // Check the syntax within:
            const nextDelimiterIndex = value.slice(index).indexOf(delimiterString);
            const valueToMatch = value.slice(0,
                // Don't allow the wrapped syntax to read beyond the next delimiter
                nextDelimiterIndex !== -1
                    ? index + nextDelimiterIndex
                    : undefined
            );

            const submatch = wrappedSyntax.match(
                valueToMatch,
                index
            );

            // If we run into non-matching values, we're done. Return everything up
            // to the last matching part:
            if (!submatch) {
                return {
                    matchCount,
                    type: 'full',
                    consumed: lastPartMatchEndIndex - startIndex
                };
            }

            index += submatch.consumed;
            lastPartMatchEndIndex = index;

            if (submatch.type === 'partial') {
                // An incomplete match means we're done, we stop here and return
                // what we have so far as a partially complete value
                return {
                    matchCount,
                    type: 'partial',
                    consumed: index - startIndex
                };
            }

            matchCount += 1;

            const delimiterMatch = delimiterSyntax.match(value, index);
            if (!delimiterMatch || delimiterMatch.consumed === 0) {
                // If we have a non-delimiter (or we're at the end of the string) stop.
                return { matchCount, type: 'full', consumed: index - startIndex };
            } else if (delimiterMatch.type === 'partial') {
                // If we have part of a delimiter, we partially match it
                return {
                    matchCount,
                    type: 'partial',
                    consumed: delimiterMatch.consumed + (index - startIndex)
                };
            }

            // Otherwise we must have a whole delimiter. We consume any following spaces too,
            // and then we go around again.
            index += delimiterMatch.consumed;
            while (value[index] === ' ') index += 1;
        }
    }

    match(value: string, startIndex: number): SyntaxPartMatch | undefined {
        const { minimumRepetitions } = this;

        const {
            matchCount,
            type: matchType,
            consumed
        } = this.matchSyntaxOnly(value, startIndex);

        if (consumed === 0) {
            if (minimumRepetitions <= 0) {
                return { type: 'full', consumed };
            } else {
                return { type: 'partial', consumed };
            }
        } else if (matchType === 'full') {
            if (matchCount >= minimumRepetitions) {
                return { type: 'full', consumed };
            } else if (startIndex + consumed === value.length) {
                // If you have a full match with too few parts, but up to the
                // end of the string, then it's a partial match (we can append to complete)
                return { type: 'partial', consumed: consumed };
            } else {
                // If you have a full match that's too short, with subequent content
                // present, then it's just a complete mismatch.
                return;
            }
        } else {
            return { type: matchType, consumed };
        }
    }

    getSuggestions(value: string, initialIndex: number, context?: C): SyntaxSuggestion[] {
        // getSuggestions requires a match. That means we can find the right suggestion
        // by looping through part matches until we find the first partial match or a
        // mismatch, and then ask the last matching part for suggestions.
        const {
            wrappedSyntax,
            delimiterSyntax,
            delimiterString,
            minimumRepetitions
        } = this;

        let index = initialIndex;
        let matchCount = 0;

        while (true) {
            const nextDelimiterIndex = value.slice(index).indexOf(delimiterString);
            const valueToMatch = value.slice(0,
                // Don't allow the wrapped syntax to read beyond the next delimiter
                nextDelimiterIndex !== -1
                    ? index + nextDelimiterIndex
                    : undefined
            );

            const wrappedMatch = wrappedSyntax.match(valueToMatch, index);
            if (!wrappedMatch) {
                // Must be a full match on the parsed content up to the last delimiter
                // (if any) because otherwise this is no match at all, and getSuggestions
                // always requires a match first.
                return [{
                    matchType: 'full',
                    index: matchCount > 0
                        ? index - delimiterString.length
                        : index,
                    showAs: '',
                    value: ''
                }];
            } else if (wrappedMatch.type === 'partial') {
                // We have a partial match on our contents, so suggest continuing it
                const suggestions = wrappedSyntax.getSuggestions(value, index, context);
                if (matchCount + 1 < minimumRepetitions) {
                    return suggestions.map(suggestion => ({
                        ...suggestion,
                        // Downgrade the match to partial if we still wouldn't have
                        // enough repetitions yet
                        matchType: suggestion.matchType === 'full'
                            ? 'partial'
                            : suggestion.matchType
                    }));
                } else {
                    return suggestions;
                }
            }

            // We have a full match, so we just keep going
            index += wrappedMatch.consumed;
            matchCount += 1;

            const delimiterMatch = delimiterSyntax.match(value, index);
            if (!delimiterMatch) {
                // Non-delimiter after a valid value - we have to stop here.
                return [{
                    matchType: 'full',
                    index: index,
                    showAs: '',
                    value: ''
                }];
            } else if (delimiterMatch.type === 'partial' || value[index + delimiterMatch.consumed] === undefined) {
                // If we have a partial delimiter, no delimiter, or a delimiter but no following space at
                // the end of the value: suggest completing a nice delimiter+space+template for the next value.
                const suggestions: SyntaxSuggestion[] = [{
                    showAs: `${delimiterString} {another ${this.placeholderName}}`,
                    index,
                    value: delimiterString + ' ',
                    matchType: 'template'
                }];

                // If we could stop here, and there's no delimiter entered at all
                // yet, suggest that too:
                if (delimiterMatch.consumed === 0 && matchCount >= minimumRepetitions) {
                    suggestions.unshift({
                        showAs: "",
                        index,
                        value: "",
                        matchType: 'full'
                    });
                }

                return suggestions;
            } else { // Full delimiter match before the end of the string:
                // Consume the delimiter and any following spaces, then continue:
                index += delimiterMatch.consumed;
                while (value[index] === ' ') index += 1;
            }
        }
    }

    parse(value: string, index: number): V[] {
        const match = this.match(value, index)!;

        if (match.type === 'full' && match.consumed === 0) return [];

        const matchedValue = value.slice(index, index + match.consumed);
        const matchedValueParts = matchedValue.split(this.delimiterString);
        return matchedValueParts.map((part) => this.wrappedSyntax.parse(part.trim(), 0));
    }

}

export class NumberSyntax implements SyntaxPart<number> {

    private stringSyntax: StringSyntax;

    constructor(name: string = "number") {
        this.stringSyntax = new StringSyntax(name, { allowedChars: [NUMBER_CHARS] });
    }

    match(value: string, index: number): SyntaxPartMatch | undefined {
        return this.stringSyntax.match(value, index);
    }

    getSuggestions(value: string, index: number): SyntaxSuggestion[] {
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

    match(value: string, index: number): undefined | SyntaxPartMatch {
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

    getSuggestions(value: string, index: number, context?: S): SyntaxSuggestion[] {
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
                index,
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
                index,
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

/**
 * Matches one syntax from a list of possible options.
 */
export class OptionsSyntax<
    Options extends readonly SyntaxPart<any, any>[],
    V extends (Options extends Array<SyntaxPart<infer V, any>> ? V : never),
    C extends (Options extends Array<SyntaxPart<any, infer C>> ? C : never),
> implements SyntaxPart<V, C> {

    private options: Options;

    constructor(options: Options) {
        this.options = options;
    }

    match(value: string, index: number): SyntaxPartMatch | undefined {
        const matches = this.options.map((option) =>
            option.match(value, index)
        ).filter(m => !!m) as SyntaxPartMatch[];

        const [fullMatches, partialMatches] = _.partition(matches, { type: 'full' });

        // Use full matches by preference, if there is one available:
        const bestMatches = fullMatches.length ? fullMatches : partialMatches;

        // Return the longest match within that list:
        return _.maxBy(bestMatches, m => m.consumed);
    }

    getSuggestions(
        value: string,
        index: number,
        context?: C
    ): SyntaxSuggestion[] {
        const matchingOptions = this.options
            .map((option) => ({ option, match: option.match(value, index) }))
            .filter(({ match }) => !!match);

        // If there's an exact match, suggest only that.
        // If there's two (https -> http + https) suggest the longest
        if (matchingOptions.some(({ match }) => match!.type === 'full')) {
            const fullyMatchingOptions = matchingOptions
                .filter(({ match }) => match!.type === 'full');

            const longestFullMatch = _.maxBy(fullyMatchingOptions, ({ match }) =>
                match!.consumed
            )!;

            return longestFullMatch.option.getSuggestions(value, index, context);
        } else {
            // Otherwise, combine all the options together
            return _.flatMap(matchingOptions, ({ option }) => {
                if (matchingOptions.length > 1 && option instanceof CombinedSyntax) {
                    // If we already have many options, don't allow combined syntax to generate its
                    // own options, or everything gets rapidly out of hand
                    return option.getSuggestions(value, index, Object.assign({},
                        context,
                        { canExtend: false }
                    ));
                } else {
                    return option.getSuggestions(value, index, context)
                }
            });
        }
    }

    parse(value: string, index: number): V {
        const fullMatches = this.options.map((option) => ({
            option,
            match: option.match(value, index)
        })).filter(({ match }) => match?.type === 'full');

        const bestMatch = _.maxBy(fullMatches, ({ match }) => match!.consumed);

        return bestMatch!.option.parse(value, index);
    }
}

/**
 * A convenient helper, when the options are all just fixed strings.
 */
export class StringOptionsSyntax<
    V extends string
> extends OptionsSyntax<Array<FixedStringSyntax<V>>, V, never> {

    constructor(
        values: readonly V[]
    ) {
        super(values.map(v => new FixedStringSyntax(v)));
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

    match(value: string, index: number): SyntaxPartMatch | undefined {
        let currentIndex = index;

        // Optional syntax matches and disappears if there's no content available
        if (currentIndex >= value.length) {
            return { type: 'full', consumed: 0 };
        }

        const subMatch = matchSyntax(this.subParts, value, index);

        // Optional syntax matches and disappears if the sub-syntax doesn't match at all
        if (!subMatch) {
            return { type: 'full', consumed: 0 };
        }

        // Optional syntax matches full like normal syntax if the contained syntax matches
        if (subMatch.type === 'full') {
            return { type: 'full', consumed: subMatch.fullyConsumed };
        }

        // If the contained syntax partially matches, it's only a partial match if we're
        // at the end of the string. If we're not, then we match 0 & disappear, and the
        // filter's matching continues to the next part (if any)
        if (index + subMatch.partiallyConsumed === value.length) {
            return { type: 'partial', consumed: subMatch.partiallyConsumed };
        } else {
            return { type: 'full', consumed: 0 };
        }
    }

    getSuggestions(value: string, index: number, context?: C): SyntaxSuggestion[] {
        const subPartMatch = this.match(value, index);
        const subPartSuggestions = getSuggestions(
            [{ key: null, syntax: this.subParts }],
            value,
            index,
            { context }
        ).map(({ suggestion }) => suggestion);

        const isEndOfValue = value.length === index;

        if (isEndOfValue) {
            // If we're at the end of the string, we offer all suggestions and no suggestion
            return [
                { showAs: "", index, value: "", matchType: 'full' },
                ...subPartSuggestions
            ];
        } else if (subPartMatch?.type === 'full' && subPartMatch?.consumed === 0) {
            // If the matcher doesn't match at all, we suggest skipping this optional
            // part entirely. This effectively allows backtracking for suggestions
            // so the suggestion is shown only if the next non-optional part _does_
            // match this content correctly.
            return [{
                showAs: "",
                index,
                value: "",
                matchType: 'full'
            }];
        } else {
            return subPartSuggestions;
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

/**
 * Matches a series of pieces of syntax as a single syntax wrapper. This is useful to
 * compose with other nested syntax, allowing them to treat a chunk of syntax as a
 * single unit.
 */
export class CombinedSyntax<
    Ps extends unknown[] = unknown[],
    C = never,
    SPs extends { [i in keyof Ps]: SyntaxPart<Ps[i], C> }
        = { [i in keyof Ps]: SyntaxPart<Ps[i], C> }
> implements SyntaxPart<Ps, C & { canExtend?: boolean }> {

    private subParts: SPs;

    constructor(...subParts: SPs) {
        this.subParts = subParts; // Apparently ... isn't allowed in field params.
    }

    match(value: string, index: number): SyntaxPartMatch | undefined {
        const subMatch = matchSyntax(this.subParts, value, index);
        return subMatch
            ? { type: subMatch?.type, consumed: subMatch?.partiallyConsumed }
            : undefined;
    }

    getSuggestions(
        value: string,
        index: number,
        context?: C & { canExtend?: boolean }
    ): SyntaxSuggestion[] {
        return getSuggestions(
            [{ key: null, syntax: this.subParts }],
            value,
            index,
            { context, canExtend: context?.canExtend }
        ).map(({ suggestion }) => suggestion);
    }

    parse(value: string, index: number): Ps {
        // Parse implies a full match, so we must have a full match for every part.
        // Loop through, return the parsed parts as an array.
        return _.reduce(this.subParts, (parsed: Ps[], part: SyntaxPart<any>) => {
            const parsedValue = part.parse(value, index);
            index += parsedValue.toString().length;
            parsed.push(parsedValue as any);
            return parsed;
        }, []) as Ps;
    }
}