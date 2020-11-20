import { expect } from '../../../test-setup';

import {
    charRange,
    FixedStringSyntax,
    StringSyntax,
    NumberSyntax,
    FixedLengthNumberSyntax,
    StringOptionsSyntax
} from "../../../../src/model/filters/syntax-parts";

describe("Fixed string syntax", () => {

    it("should not match completely different strings", () => {
        const part = new FixedStringSyntax("a-string");
        expect(part.match("other-string", 0)).to.equal(undefined);
    });

    it("should partially match string prefixes", () => {
        const part = new FixedStringSyntax("a-string");

        const match = part.match("a-st", 0)!;
        expect(match.type).to.equal('partial');
        expect(match.consumed).to.equal(4);
    });

    it("should partially match strings ignoring case", () => {
        const part = new FixedStringSyntax("a-string");

        const match = part.match("A-ST", 0)!;
        expect(match.type).to.equal('partial');
        expect(match.consumed).to.equal(4);
    });

    it("should fully match string matches", () => {
        const part = new FixedStringSyntax("a-string");

        const match = part.match("a-string", 0)!;
        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(8);
    });

    it("should fully match string matches ignoring case", () => {
        const part = new FixedStringSyntax("a-string");

        const match = part.match("A-STRING", 0)!;
        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(8);
    });

    it("should match strings with suffixes", () => {
        const part = new FixedStringSyntax("a-string");

        const match = part.match("a-string-with-suffix", 0)!;
        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(8);
    });

    it("should not match strings with prefixes", () => {
        const part = new FixedStringSyntax("a-string");

        expect(part.match("prefix-on-a-string", 0)).to.equal(undefined);
    });

    it("should partially match strings with prefixes before the index", () => {
        const part = new FixedStringSyntax("a-string");

        const match = part.match("prefix-on-a-str", 10)!;

        expect(match.type).to.equal('partial');
        expect(match.consumed).to.equal(5);
    });

    it("should fully match strings with prefixes before the index", () => {
        const part = new FixedStringSyntax("a-string");

        const match = part.match("prefix-on-a-string", 10)!;

        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(8);
    });

    it("should partially match at the end of a string", () => {
        const part = new FixedStringSyntax("a-string");

        const match = part.match("prefix", 6)!;

        expect(match.type).to.equal('partial');
        expect(match.consumed).to.equal(0);
    });

    it("should suggest completing the string", () => {
        const part = new FixedStringSyntax("a-string");

        const suggestions = part.getSuggestions("a-str", 0)!;

        expect(suggestions.length).to.equal(1);
        expect(suggestions[0].showAs).to.equal('a-string');
        expect(suggestions[0].value).to.equal('a-string');
    });

    it("should suggest completing a completed string", () => {
        const part = new FixedStringSyntax("a-string");

        const suggestions = part.getSuggestions("a-string", 0)!;

        expect(suggestions.length).to.equal(1);
        expect(suggestions[0].showAs).to.equal('a-string');
        expect(suggestions[0].value).to.equal('a-string');
    });

    it("should suggest completing the string at a given index", () => {
        const part = new FixedStringSyntax("a-string");

        const suggestions = part.getSuggestions("prefix-on-a-str", 10)!;

        expect(suggestions.length).to.equal(1);
        expect(suggestions[0].showAs).to.equal('a-string');
        expect(suggestions[0].value).to.equal('a-string');
    });

    it("should suggest completion at the end of a string", () => {
        const part = new FixedStringSyntax("a-string");

        const suggestions = part.getSuggestions("prefix", 6)!;

        expect(suggestions.length).to.equal(1);
        expect(suggestions[0].showAs).to.equal('a-string');
        expect(suggestions[0].value).to.equal('a-string');
    });

    it("should be able to parse a completed value", () => {
        const part = new FixedStringSyntax("a-string");
        expect(part.parse("a-string", 0)).to.equal("a-string");
    });

    it("should be able to parse a completed value ignoring case", () => {
        const part = new FixedStringSyntax("a-string");
        expect(part.parse("A-STRING", 0)).to.equal("a-string");
    });

});

describe("Number syntax", () => {

    it("should not match strings", () => {
        const part = new NumberSyntax();
        expect(part.match("string", 0)).to.equal(undefined);
    });

    it("should fully match numbers", () => {
        const part = new NumberSyntax();

        const match = part.match("12345", 0)!;
        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(5);
    });

    it("should not match numbers with prefixes", () => {
        const part = new NumberSyntax();

        const match = part.match("string-123", 0)!;
        expect(match).to.equal(undefined);
    });

    it("should fully match numbers with suffixes", () => {
        const part = new NumberSyntax();

        const match = part.match("123-string", 0)!;
        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(3);
    });

    it("should fully match numbers with prefixes before the index", () => {
        const part = new NumberSyntax();

        const match = part.match("string-123", 7)!;

        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(3);
    });

    it("should partially match at the end of a string", () => {
        const part = new NumberSyntax();

        const match = part.match("string-", 7)!;

        expect(match.type).to.equal('partial');
        expect(match.consumed).to.equal(0);
    });

    it("should suggest inserting a number", () => {
        const part = new NumberSyntax();

        const suggestions = part.getSuggestions("value=", 6)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: '{number}',
                value: '',
                template: true
            }
        ]);
    });

    it("should suggest completing an existing number", () => {
        const part = new NumberSyntax();

        const suggestions = part.getSuggestions("value=123", 6)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: '123',
                value: '123'
            }
        ]);
    });

    it("should be able to parse a completed value", () => {
        const part = new NumberSyntax();
        expect(part.parse("123", 0)).to.equal(123);
    });

});

describe("Fixed-length number syntax", () => {

    it("should not match strings", () => {
        const part = new FixedLengthNumberSyntax(3);
        expect(part.match("str", 0)).to.equal(undefined);
    });

    it("should fully match numbers of the correct length", () => {
        const part = new FixedLengthNumberSyntax(3);

        const match = part.match("123", 0)!;
        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(3);
    });

    it("should partially match too-short numbers", () => {
        const part = new FixedLengthNumberSyntax(3);

        const match = part.match("12", 0)!;
        expect(match.type).to.equal('partial');
        expect(match.consumed).to.equal(2);
    });

    it("should not match too-long numbers", () => {
        const part = new FixedLengthNumberSyntax(3);

        const match = part.match("1234", 0)!;
        expect(match).to.equal(undefined);
    });

    it("should fully match numbers with prefixes before the index", () => {
        const part = new FixedLengthNumberSyntax(3);

        const match = part.match("string-123", 7)!;

        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(3);
    });

    it("should partially match at the end of a string", () => {
        const part = new FixedLengthNumberSyntax(3);

        const match = part.match("string-", 7)!;

        expect(match.type).to.equal('partial');
        expect(match.consumed).to.equal(0);
    });

    it("should suggest inserting a number of the right length", () => {
        const part = new FixedLengthNumberSyntax(3);

        const suggestions = part.getSuggestions("value=", 6)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: '{3-digit number}',
                value: '',
                template: true
            }
        ]);
    });

    it("should suggest extending a number to the right length", () => {
        const part = new FixedLengthNumberSyntax(3);

        const suggestions = part.getSuggestions("value=50", 6)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: '500',
                value: '500'
            }
        ]);
    });

    it("should suggest inserting a correct-length number", () => {
        const part = new FixedLengthNumberSyntax(3);

        const suggestions = part.getSuggestions("value=418", 6)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: '418',
                value: '418'
            }
        ]);
    });

    it("should include completions from a given context", () => {
        const context = [
            { value: "404" },
            { value: "201" }
        ];

        const part = new FixedLengthNumberSyntax<typeof context>(3, {
            suggestionGenerator: (_v, _i, context) => context.map(x => x.value)
        });

        const suggestions = part.getSuggestions("value=", 6, context)!;

        expect(suggestions).to.deep.equal([
            { showAs: '{3-digit number}', value: '', template: true },
            { showAs: '404', value: '404' },
            { showAs: '201', value: '201' }
        ]);
    });

    it("should extend using just matching context completions, if available", () => {
        const context = [
            { value: "404" },
            { value: "201" },
            { value: "202" }
        ];

        const part = new FixedLengthNumberSyntax<typeof context>(3, {
            suggestionGenerator: (_v, _i, context) => context.map(x => x.value)
        });

        const suggestions = part.getSuggestions("value=2", 6, context)!;

        expect(suggestions).to.deep.equal([
            { showAs: '201', value: '201' },
            { showAs: '202', value: '202' }
        ]);
    });

    it("should extend as normal if no context completions match", () => {
        const context = [
            { value: "404" },
            { value: "201" }
        ];

        const part = new FixedLengthNumberSyntax<typeof context>(3, {
            suggestionGenerator: (_v, _i, context) => context.map(x => x.value)
        });

        const suggestions = part.getSuggestions("value=3", 6, context)!;

        expect(suggestions).to.deep.equal([
            { showAs: '300', value: '300' }
        ]);
    });

    it("should be able to parse a completed value", () => {
        const part = new FixedLengthNumberSyntax(3);
        expect(part.parse("123", 0)).to.equal(123);
    });

});

describe("String syntax", () => {

    it("should not match invalid chars", () => {
        const part = new StringSyntax("a string", { allowedChars: [charRange("a", "z")] });
        expect(part.match("ABC", 0)).to.equal(undefined);
    });

    it("should match valid chars", () => {
        const part = new StringSyntax("a string", { allowedChars: [charRange("a", "z")] });

        const match = part.match("abc", 0)!;
        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(3);
    });

    it("should not match valid chars with prefixes", () => {
        const part = new StringSyntax("a string", { allowedChars: [charRange("a", "z")] });

        const match = part.match("123-abc", 0)!;
        expect(match).to.equal(undefined);
    });

    it("should fully match valid chars with suffixes", () => {
        const part = new StringSyntax("a string", { allowedChars: [charRange("a", "z")] });

        const match = part.match("abcABC", 0)!;
        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(3);
    });

    it("should fully match valid chars with prefixes before the index", () => {
        const part = new StringSyntax("a string", { allowedChars: [charRange("a", "z")] });

        const match = part.match("123-abc", 4)!;

        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(3);
    });

    it("should match from multiple sets of valid chars", () => {
        const part = new StringSyntax(
            "a string",
            { allowedChars: [charRange("a", "z"), charRange("A", "Z")] }
        );

        const match = part.match("aBc123", 0)!;
        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(3);
    });

    it("should partially match an empty string", () => {
        const part = new StringSyntax("a string", { allowedChars: [charRange("a", "z")] });

        const match = part.match("", 0)!;

        expect(match.type).to.equal('partial');
        expect(match.consumed).to.equal(0);
    });

    it("should partially match at the end of a string", () => {
        const part = new StringSyntax("a string", { allowedChars: [charRange("a", "z")] });

        const match = part.match("string-", 7)!;

        expect(match.type).to.equal('partial');
        expect(match.consumed).to.equal(0);
    });

    it("should allow any chars if no range is specified", () => {
        const part = new StringSyntax("a string");

        const match = part.match("abc123!!!", 0)!;
        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(9);
    });

    it("should allow empty strings if requested", () => {
        const part = new StringSyntax("a string", { allowEmpty: true });

        const match = part.match("", 0)!;
        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(0);
    });

    it("should suggest inserting valid chars", () => {
        const part = new StringSyntax("a string", { allowedChars: [charRange("a", "z")] });

        const suggestions = part.getSuggestions("value=", 6)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: '{a string}',
                value: '',
                template: true
            }
        ]);
    });

    it("should include completions from a given context", () => {
        const context = [
            { value: "a value" },
            { value: "a different value" }
        ];

        const part = new StringSyntax<typeof context>("a string", {
            suggestionGenerator: (_v, _i, context) => context.map(x => x.value)
        });

        const suggestions = part.getSuggestions("value=", 6, context)!;

        expect(suggestions).to.deep.equal([
            { showAs: '{a string}', value: '', template: true },
            { showAs: 'a value', value: 'a value' },
            { showAs: 'a different value', value: 'a different value' }
        ]);
    });

    it("should suggest completing existing valid chars", () => {
        const part = new StringSyntax("a string", { allowedChars: [charRange("a", "z")] });

        const suggestions = part.getSuggestions("value=chars", 6)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: 'chars',
                value: 'chars'
            }
        ]);
    });

    it("should include only the matching completions from the context", () => {
        const context = [
            { value: "a value" },
            { value: "non-matching value" },
            { value: "a different value" }
        ];

        const part = new StringSyntax<typeof context>("a string", {
            allowedChars: [[0, 255]],
            suggestionGenerator: (_v, _i, cs) => cs.map(x => x.value)
        });

        const suggestions = part.getSuggestions("a ", 0, context)!;

        expect(suggestions).to.deep.equal([
            { showAs: 'a ', value: 'a ' },
            { showAs: 'a value', value: 'a value' },
            { showAs: 'a different value', value: 'a different value' }
        ]);
    });

    it("should be able to parse a completed value", () => {
        const part = new StringSyntax("a string", { allowedChars: [charRange("a", "z")] });
        expect(part.parse("abcd", 0)).to.equal("abcd");
    });

});

describe("String options syntax", () => {

    it("should not match completely different strings", () => {
        const part = new StringOptionsSyntax(["a", "b"]);
        expect(part.match("c", 0)).to.equal(undefined);
    });

    it("should partially match string prefixes", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        const match = part.match("a", 0)!;
        expect(match.type).to.equal('partial');
        expect(match.consumed).to.equal(1);
    });

    it("should fully match string matches", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        const match = part.match("bc", 0)!;
        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(2);
    });

    it("should prefer the longest full match", () => {
        const part = new StringOptionsSyntax(["a", "ab", "abc"]);

        const match = part.match("ab", 0)!;
        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(2);
    });

    it("should match strings with suffixes", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        const match = part.match("abcd", 0)!;
        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(2);
    });

    it("should not match strings with prefixes", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        expect(part.match("prefix-on-ab", 0)).to.equal(undefined);
    });

    it("should partially match strings with prefixes before the index", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        const match = part.match("prefix-on-a", 10)!;

        expect(match.type).to.equal('partial');
        expect(match.consumed).to.equal(1);
    });

    it("should fully match strings with prefixes before the index", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        const match = part.match("prefix-on-ab", 10)!;

        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(2);
    });

    it("should partially match at the end of a string", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        const match = part.match("prefix", 6)!;

        expect(match.type).to.equal('partial');
        expect(match.consumed).to.equal(0);
    });

    it("should suggest completing the string", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        const suggestions = part.getSuggestions("a", 0)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: 'ab',
                value: 'ab'
            }
        ]);
    });

    it("should suggest all valid completions of the string", () => {
        const part = new StringOptionsSyntax(["ab", "abc", "ad", "bc"]);

        const suggestions = part.getSuggestions("a", 0)!;

        expect(suggestions.length).to.equal(3);
        expect(suggestions).to.deep.equal([
            { showAs: "ab", value: "ab" },
            { showAs: "abc", value: "abc" },
            { showAs: "ad", value: "ad" }
        ]);
    });

    it("should suggest completing a completed string", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        const suggestions = part.getSuggestions("ab", 0)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: 'ab',
                value: 'ab'
            }
        ]);
    });

    it("should suggest completing the string at a given index", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        const suggestions = part.getSuggestions("prefix-on-a", 10)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: 'ab',
                value: 'ab'
            }
        ]);
    });

    it("should suggest completion at the end of a string", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        const suggestions = part.getSuggestions("prefix", 6)!;

        expect(suggestions.length).to.equal(2);
        expect(suggestions).to.deep.equal([
            { showAs: "ab", value: "ab" },
            { showAs: "bc", value: "bc" }
        ]);
    });

    it("should be able to parse a completed value", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        const parsedValue: "ab" | "bc" = part.parse("ab", 0); // Test type inference too
        expect(parsedValue).to.equal("ab");
    });

});