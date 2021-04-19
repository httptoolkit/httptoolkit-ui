import * as _ from 'lodash';

import {
    SyntaxPart,
    SyntaxPartMatch,
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

export class FixedStringSyntax implements SyntaxPart<string> {

    constructor(
        private matcher: string
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

        const suggestionsToWrap = this.wrappedSyntax.getSuggestions(
            valueToMatch,
            hasStartWrapper
                ? index + 1
                : index,
            context
        );

        return suggestionsToWrap.map(s => {
            const shouldAddWrapper = !this.optional ||
                s.value.includes(' ');

            if (!shouldAddWrapper) return s;

            return {
                matchType: s.matchType,
                // We should show closing wrapper on templates (after template is shown)
                // and full matches, e.g. [{temp}] or [value] or [partialSu
                showAs: this.wrapper[0] + s.showAs + (
                    s.matchType === 'full' || s.matchType === 'template'
                    ? this.wrapper[1]
                    : ''
                ),
                index,
                // Value should only add the closing wrapper if it's a full match, e.g.
                // [value] or [ for template/partial.
                value: this.wrapper[0] + s.value + (
                    s.matchType === 'full'
                    ? this.wrapper[1]
                    : ''
                )
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

export class StringOptionsSyntax<OptionsType extends string = string> implements SyntaxPart<OptionsType> {

    private optionMatchers: FixedStringSyntax[];

    constructor(
        options: Array<OptionsType>
    ) {
        this.optionMatchers = options.map(s => new FixedStringSyntax(s));
    }

    match(value: string, index: number): SyntaxPartMatch | undefined {
        const matches = this.optionMatchers
            .map(m => m.match(value, index))
            .filter(m => !!m);

        const [fullMatches, partialMatches] = _.partition(matches, { type: 'full' });

        const bestMatches = fullMatches.length ? fullMatches : partialMatches;
        return _.maxBy(bestMatches, (m) => m?.consumed); // The longest best matching option
    }

    getSuggestions(value: string, index: number): SyntaxSuggestion[] {
        let matchers = this.optionMatchers
            .map(m => ({ matcher: m, match: m.match(value, index) }))
            .filter(({ match }) => !!match);

        // If there's an exact match, suggest only that.
        // If there's two (https -> http + https) suggest the longest
        if (matchers.some(({ match }) => match!.type === 'full')) {
            matchers = [_.maxBy(
                matchers.filter(({ match }) => match!.type === 'full'),
                ({ match }) => match!.consumed
            )!];
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

    match(value: string, index: number): SyntaxPartMatch | undefined {
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

    getSuggestions(value: string, index: number, context?: C): SyntaxSuggestion[] {
        const isEndOfValue = value.length === index;
        let currentIndex = index;
        let suggestions: SyntaxSuggestion[] = [{
            showAs: "",
            index,
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
            if (!nextMatch) return [{
                showAs: "",
                index,
                value: "",
                matchType: 'full'
            }];

            matchedAllParts = subPart === this.subParts[this.subParts.length - 1];

            const nextSuggestions = subPart.getSuggestions(value, currentIndex, context);

            suggestions = _.flatMap(suggestions, (suggestion) =>
                nextSuggestions.map((nextSuggestion) => ({
                    showAs: suggestion.showAs + nextSuggestion.showAs,
                    index: suggestion.index,
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
                { showAs: "", index, value: "", matchType: 'full' },
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