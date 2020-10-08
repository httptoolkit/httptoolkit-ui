import * as _ from 'lodash';

export type SyntaxMatch = {
    type: 'partial' | 'full';
    consumed: number;
};

export interface Suggestion {
    showAs: string;
    value: string;
}

export interface SyntaxPart {
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
     * Given that there was a partial match, this returns a list of
     * possible values that would make this syntax part match fully.
     *
     * Don't call it without a partial match, as the behaviour is
     * undefined.
     */
    getSuggestions(value: string, index: number): Suggestion[];
};

export class FixedStringSyntax implements SyntaxPart {

    constructor(
        private matcher: string
    ) {}

    match(value: string, index: number): undefined | SyntaxMatch {
        let i: number;

        // Compare char by char over the common size
        for (i = index; (i - index) < this.matcher.length && i < value.length; i++) {
            if (this.matcher[i - index] !== value[i]) return undefined;
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
            value: this.matcher
        }];
    }

}

function isNumberChar(char: string) {
    const code = char.charCodeAt(0);
    return code >= 48 && code <= 59; // 0-9 ascii codes
}

/**
 * Match a number at this position. Returns the number (as a string)
 * if one is present here, an empty string if this is the end of the
 * string, so a number _could_ be appended here, and undefined if
 * it could not (i.e. a non-number is already present)
 */
function getNumberAt(value: string, index: number) {
    let i: number;

    // Keep reading number chars until we either hit the end of the
    // string (maybe immediately) or hit a non-number
    for (i = index; i < value.length; i++) {
        if (!isNumberChar(value[i])) break;
    }

    if (i !== index) {
        // We found at least one number, that's a match:
        return value.substring(index, i);
    } else if (i === value.length) {
        // We were at the end of the string, that's an empty partial match:
        return "";
    } else {
        // We found no characters, and no end of string: fail
        return undefined;
    }
}

export class NumberSyntax implements SyntaxPart {

    match(value: string, index: number): undefined | SyntaxMatch {
        const matchingNumber = getNumberAt(value, index);
        if (matchingNumber === undefined) return;

        const consumedChars = matchingNumber.length;

        // Any number is a full match, any empty space is a potential number
        return {
            type: (consumedChars > 0)
                ? 'full'
                : 'partial',
            consumed: consumedChars
        };
    }

    getSuggestions(value: string, index: number): Suggestion[] {
        const matchingNumber = getNumberAt(value, index);

        if (!matchingNumber) {
            return [{
                showAs: "<number>",
                value: '0'
            }];
        } else {
            return [{
                showAs: matchingNumber,
                value: matchingNumber
            }];
        }
    }

}
export class FixedLengthNumberSyntax implements SyntaxPart {

    constructor(
        private requiredLength: number
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

    getSuggestions(value: string, index: number): Suggestion[] {
        const matchingNumber = getNumberAt(value, index);

        if (!matchingNumber) {
            return [{
                showAs: `<${this.requiredLength}-digit number>`,
                value: _.repeat("0", this.requiredLength)
            }];
        } else {
            const extendedNumber = matchingNumber +
                _.repeat("0", this.requiredLength - matchingNumber.length);

            return [{
                showAs: extendedNumber,
                value: extendedNumber
            }];
        }
    }

}