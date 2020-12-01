import { expect } from '../../../test-setup';

import {
    charRange,
    FixedStringSyntax,
    StringSyntax,
    NumberSyntax,
    FixedLengthNumberSyntax,
    StringOptionsSyntax,
    OptionalSyntax,
    SyntaxWrapperSyntax
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
                matchType: 'template'
            }
        ]);
    });

    it("should suggest completing an existing number", () => {
        const part = new NumberSyntax();

        const suggestions = part.getSuggestions("value=123", 6)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: '123',
                value: '123',
                matchType: 'full'
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
                matchType: 'template'
            }
        ]);
    });

    it("should suggest extending a number to the right length", () => {
        const part = new FixedLengthNumberSyntax(3);

        const suggestions = part.getSuggestions("value=50", 6)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: '500',
                value: '500',
                matchType: 'full'
            }
        ]);
    });

    it("should suggest inserting a correct-length number", () => {
        const part = new FixedLengthNumberSyntax(3);

        const suggestions = part.getSuggestions("value=418", 6)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: '418',
                value: '418',
                matchType: 'full'
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
            { showAs: '{3-digit number}', value: '', matchType: 'template' },
            { showAs: '404', value: '404', matchType: 'full' },
            { showAs: '201', value: '201', matchType: 'full' }
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
            { showAs: '201', value: '201', matchType: 'full' },
            { showAs: '202', value: '202', matchType: 'full' }
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
            { showAs: '300', value: '300', matchType: 'full' }
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
        const part = new StringSyntax("a string", { allowEmpty: () => true });

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
                matchType: 'template'
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
            { showAs: '{a string}', value: '', matchType: 'template' },
            { showAs: 'a value', value: 'a value', matchType: 'full' },
            { showAs: 'a different value', value: 'a different value', matchType: 'full' }
        ]);
    });

    it("should suggest completing existing valid chars", () => {
        const part = new StringSyntax("a string", { allowedChars: [charRange("a", "z")] });

        const suggestions = part.getSuggestions("value=chars", 6)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: 'chars',
                value: 'chars',
                matchType: 'full'
            }
        ]);
    });

    it("should include only the matching completions from the context", () => {
        const context = [
            { value: "a " },
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
            { showAs: 'a ', value: 'a ', matchType: 'full' },
            { showAs: 'a value', value: 'a value', matchType: 'full' },
            { showAs: 'a different value', value: 'a different value', matchType: 'full' }
        ]);
    });

    it("should be able to parse a completed value", () => {
        const part = new StringSyntax("a string", { allowedChars: [charRange("a", "z")] });
        expect(part.parse("abcd", 0)).to.equal("abcd");
    });

});

describe("Wrapper syntax", () => {

    it("should matched a wrapped value", () => {
        const part = new SyntaxWrapperSyntax(
            ['[', ']'],
            new StringSyntax("string")
        );
        expect(part.match("[x]", 0)).to.deep.equal({
            type: 'full',
            consumed: 3
        });
    });

    it("should not match unwrapped values", () => {
        const part = new SyntaxWrapperSyntax(
            ['[', ']'],
            new StringSyntax("string")
        );
        expect(part.match("x", 0)).to.equal(undefined);
    });

    it("should support optional wrapping", () => {
        const part = new SyntaxWrapperSyntax(
            ['[', ']'],
            new StringSyntax("string"),
            { optional: true }
        );

        expect(part.match("x", 0)).to.deep.equal({
            type: 'full',
            consumed: 1
        });

        expect(part.match("[x]", 0)).to.deep.equal({
            type: 'full',
            consumed: 3
        });
    });

    it("should allow wrapper chars within input when optional wrapping", () => {
        const part = new SyntaxWrapperSyntax(
            ['[', ']'],
            new StringSyntax("string"),
            { optional: true }
        );

        expect(part.match("abc[def]qwe", 0)).to.deep.equal({
            type: 'full',
            consumed: 11
        });

        expect(part.parse("abc[def]qwe", 0)).to.equal(
            'abc[def]qwe'
        );
    });

    it("should add a wrapper to wrapped suggestion templates", () => {
        const part = new SyntaxWrapperSyntax(
            ['[', ']'],
            new StringSyntax("string")
        );
        expect(part.getSuggestions("", 0)).to.deep.equal([{
            showAs: "[{string}]",
            value: "[",
            matchType: 'template'
        }]);
    });

    it("should add optional wrapper to suggestions only when necessary", () => {
        const part = new SyntaxWrapperSyntax(
            ['[', ']'],
            new StringOptionsSyntax([
                "abc",
                "def",
                "qwe asd"
            ]),
            { optional: true }
        );

        expect(part.getSuggestions("", 0)).to.deep.equal([
            {
                showAs: "abc",
                value: "abc",
                matchType: 'full'
            },
            {
                showAs: "def",
                value: "def",
                matchType: 'full'
            },
            {
                showAs: "[qwe asd]",
                value: "[qwe asd]",
                matchType: 'full'
            }
        ]);
    });

    it("should add a wrapper to wrapped full suggestions", () => {
        const part = new SyntaxWrapperSyntax(
            ['[', ']'],
            new StringSyntax("string")
        );
        expect(part.getSuggestions("[abc", 0)).to.deep.equal([{
            showAs: "[abc]",
            value: "[abc]",
            matchType: 'full'
        }]);
    });

    it("should parse valid wrapped input", () => {
        const part = new SyntaxWrapperSyntax(
            ['[', ']'],
            new StringSyntax("string")
        );
        expect(part.parse("[abc]", 0)).to.equal("abc");
    });

    it("should parse optional unwrapped input", () => {
        const part = new SyntaxWrapperSyntax(
            ['[', ']'],
            new StringSyntax("string"),
            { optional: true }
        );
        expect(part.parse("abc", 0)).to.equal("abc");
    });

    it("should parse optional unwrapped input containing brackets", () => {
        const part = new SyntaxWrapperSyntax(
            ['[', ']'],
            new StringSyntax("string"),
            { optional: true }
        );
        expect(part.parse("a[]", 0)).to.equal("a[]");
    });

    it("should parse optional wrapped input can parse open bracket", () => {
        const part = new SyntaxWrapperSyntax(
            ['[', ']'],
            new StringSyntax("string"),
            { optional: true }
        );
        expect(part.parse("[", 0)).to.equal("[");
    });

    it("should parse optional wrapped input containing open-brackets", () => {
        const part = new SyntaxWrapperSyntax(
            ['[', ']'],
            new StringSyntax("string"),
            { optional: true }
        );
        expect(part.parse("[[]", 0)).to.equal("[");
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
                value: 'ab',
                matchType: 'full'
            }
        ]);
    });

    it("should suggest all valid completions of the string", () => {
        const part = new StringOptionsSyntax(["ab", "abc", "ad", "bc"]);

        const suggestions = part.getSuggestions("a", 0)!;

        expect(suggestions.length).to.equal(3);
        expect(suggestions).to.deep.equal([
            { showAs: "ab", value: "ab", matchType: 'full' },
            { showAs: "abc", value: "abc", matchType: 'full' },
            { showAs: "ad", value: "ad", matchType: 'full' }
        ]);
    });

    it("should suggest completing a completed string", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        const suggestions = part.getSuggestions("ab", 0)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: 'ab',
                value: 'ab',
                matchType: 'full'
            }
        ]);
    });

    it("should suggest completing the string at a given index", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        const suggestions = part.getSuggestions("prefix-on-a", 10)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: 'ab',
                value: 'ab',
                matchType: 'full'
            }
        ]);
    });

    it("should suggest completion at the end of a string", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        const suggestions = part.getSuggestions("prefix", 6)!;

        expect(suggestions.length).to.equal(2);
        expect(suggestions).to.deep.equal([
            { showAs: "ab", value: "ab", matchType: 'full' },
            { showAs: "bc", value: "bc", matchType: 'full' }
        ]);
    });

    it("should be able to parse a completed value", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        const parsedValue: "ab" | "bc" = part.parse("ab", 0); // Test type inference too
        expect(parsedValue).to.equal("ab");
    });

});

describe("Optional syntax", () => {
    it("should fully match nothing", () => {
        const part = new OptionalSyntax(
            new FixedStringSyntax("completed")
        );

        const match = part.match("", 0)!;

        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(0);
    });

    it("should fully match a fulfilled optional value", () => {
        const part = new OptionalSyntax(
            new FixedStringSyntax("completed")
        );

        const match = part.match("completed", 0)!;

        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(9);
    });

    it("should fully match multi-part optional values", () => {
        const part = new OptionalSyntax(
            new FixedStringSyntax("hello "),
            new FixedStringSyntax("world"),
        );

        const match = part.match("hello world", 0)!;

        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(11);
    });

    it("should fully match optional values at an offset", () => {
        const part = new OptionalSyntax(
            new FixedStringSyntax("world"),
        );

        const match = part.match("hello world", 6)!;

        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(5);
    });

    it("should fully match nothing given a bad suffix", () => {
        const part = new OptionalSyntax(
            new FixedStringSyntax("completed")
        );

        const match = part.match("pending", 0)!;

        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(0);
    });

    it("should partially match a partially matching subpart", () => {
        const part = new OptionalSyntax(
            new FixedStringSyntax("completed")
        );

        const match = part.match("comp", 0)!;

        expect(match.type).to.equal('partial');
        expect(match.consumed).to.equal(4);
    });

    it("should partially match, given a partially matching 2nd subpart", () => {
        const part = new OptionalSyntax(
            new FixedStringSyntax("hello "),
            new FixedStringSyntax("world"),
        );

        const match = part.match("hello wo", 0)!;

        expect(match.type).to.equal('partial');
        expect(match.consumed).to.equal(8);
    });

    it("should suggest completing subpart partial matches", () => {
        const part = new OptionalSyntax(
            new FixedStringSyntax("hello "),
            new FixedStringSyntax("world"),
        );

        const suggestions = part.getSuggestions("hello wo", 0)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: "hello world",
                value: "hello world",
                matchType: 'full'
            }
        ]);
    });

    it("should continue suggestions through partial subpart matches", () => {
        const part = new OptionalSyntax(
            new FixedStringSyntax("hello"),
            new FixedStringSyntax("+"),
            new FixedStringSyntax("world"),
        );

        const suggestions = part.getSuggestions("he", 0)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: "hello+world",
                value: "hello+world",
                matchType: 'full'
            }
        ]);
    });

    it("should suggest completing subpart full matches", () => {
        const part = new OptionalSyntax(
            new FixedStringSyntax("hello "),
            new FixedStringSyntax("world"),
        );

        const suggestions = part.getSuggestions("hello world", 0)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: "hello world",
                value: "hello world",
                matchType: 'full'
            }
        ]);
    });

    it("should suggest ignoring or completing empty partial matches", () => {
        const part = new OptionalSyntax(
            new FixedStringSyntax("world")
        );

        const suggestions = part.getSuggestions("hello ", 6)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: "",
                value: "",
                matchType: 'full'
            },
            {
                showAs: "world",
                value: "world",
                matchType: 'full'
            }
        ]);
    });

    it("should suggest ignoring subpart non-matches", () => {
        const part = new OptionalSyntax(
            new FixedStringSyntax("hello"),
            new FixedStringSyntax("goodbye"),
        );

        const suggestions = part.getSuggestions("hello wo", 0)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: "",
                value: "",
                matchType: 'full'
            }
        ]);
    });

    it("should suggest adding template values in subpart template matches", () => {
        const part = new OptionalSyntax<string[]>(
            new FixedStringSyntax("string:"),
            new StringSyntax("string value", {
                allowedChars: [charRange("a", "z")]
            }),
        );

        const suggestions = part.getSuggestions("string:", 0)!;

        expect(suggestions).to.deep.equal([
            {
                showAs: "string:{string value}",
                value: "string:",
                matchType: 'template'
            }
        ]);
    });

    it("should be able to parse a matching value", () => {
        const part = new OptionalSyntax<[string, "+" | "-", number]>(
            new FixedStringSyntax("value:"),
            new StringOptionsSyntax(['+', '-']),
            new NumberSyntax("value")
        );

         // Test type inference too:
        const parsedValue: [string, "+" | "-", number] | [] = part.parse("value:-123", 0);

        expect(parsedValue).to.deep.equal(["value:", "-", 123]);
    });
});