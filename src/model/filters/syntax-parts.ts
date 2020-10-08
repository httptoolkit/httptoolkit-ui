
export type SyntaxMatch = {
    type: 'partial' | 'full';
    consumed: number;
};

export interface Suggestion {
    showAs: string;
    value: string;
}

export interface SyntaxPart {
    // Checks whether the syntax part matches, or _could_ match,
    // given some text appended to the result
    match(value: string, index: number): undefined | SyntaxMatch;

    // Returns a list of possible values that would make this
    // syntax part match, given that it partially matches now.
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