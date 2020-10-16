import { expect } from '../../../test-setup';

import {
    charRange,
    FixedStringSyntax,
    StringSyntax,
    NumberSyntax,
    FixedLengthNumberSyntax,
    StringOptionsSyntax,
    charRange
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

    it("should fully match string matches", () => {
        const part = new FixedStringSyntax("a-string");

        const match = part.match("a-string", 0)!;
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

        expect(suggestions.length).to.equal(1);
        expect(suggestions[0].showAs).to.equal('{number}');
        expect(suggestions[0].value).to.equal(undefined);
    });

    it("should suggest completing an existing number", () => {
        const part = new NumberSyntax();

        const suggestions = part.getSuggestions("value=123", 6)!;

        expect(suggestions.length).to.equal(1);
        expect(suggestions[0].showAs).to.equal('123');
        expect(suggestions[0].value).to.equal('123');
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

        expect(suggestions.length).to.equal(1);
        expect(suggestions[0].showAs).to.equal('{3-digit number}');
        expect(suggestions[0].value).to.equal(undefined);
    });

    it("should suggest extending a number to the right length", () => {
        const part = new FixedLengthNumberSyntax(3);

        const suggestions = part.getSuggestions("value=50", 6)!;

        expect(suggestions.length).to.equal(1);
        expect(suggestions[0].showAs).to.equal('500');
        expect(suggestions[0].value).to.equal('500');
    });

});

describe("String syntax", () => {

    it("should not match invalid chars", () => {
        const part = new StringSyntax([charRange("a", "z")], "a string");
        expect(part.match("ABC", 0)).to.equal(undefined);
    });

    it("should match valid chars", () => {
        const part = new StringSyntax([charRange("a", "z")], "a string");

        const match = part.match("abc", 0)!;
        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(3);
    });

    it("should not match valid chars with prefixes", () => {
        const part = new StringSyntax([charRange("a", "z")], "a string");

        const match = part.match("123-abc", 0)!;
        expect(match).to.equal(undefined);
    });

    it("should fully match valid chars with suffixes", () => {
        const part = new StringSyntax([charRange("a", "z")], "a string");

        const match = part.match("abcABC", 0)!;
        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(3);
    });

    it("should fully match valid chars with prefixes before the index", () => {
        const part = new StringSyntax([charRange("a", "z")], "a string");

        const match = part.match("123-abc", 4)!;

        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(3);
    });

    it("should match from multiple sets of valid chars", () => {
        const part = new StringSyntax(
            [charRange("a", "z"), charRange("A", "Z")],
        "a string");

        const match = part.match("aBc123", 0)!;
        expect(match.type).to.equal('full');
        expect(match.consumed).to.equal(3);
    });

    it("should partially match at the end of a string", () => {
        const part = new StringSyntax([charRange("a", "z")], "a string");

        const match = part.match("string-", 7)!;

        expect(match.type).to.equal('partial');
        expect(match.consumed).to.equal(0);
    });

    it("should suggest inserting valid chars", () => {
        const part = new StringSyntax([charRange("a", "z")], "a string");

        const suggestions = part.getSuggestions("value=", 6)!;

        expect(suggestions.length).to.equal(1);
        expect(suggestions[0].showAs).to.equal('{a string}');
        expect(suggestions[0].value).to.equal(undefined);
    });

    it("should suggest completing existing valid chars", () => {
        const part = new StringSyntax([charRange("a", "z")], "a string");

        const suggestions = part.getSuggestions("value=chars", 6)!;

        expect(suggestions.length).to.equal(1);
        expect(suggestions[0].showAs).to.equal('chars');
        expect(suggestions[0].value).to.equal('chars');
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

        expect(suggestions.length).to.equal(1);
        expect(suggestions[0].showAs).to.equal('ab');
        expect(suggestions[0].value).to.equal('ab');
    });

    it("should suggest all valid completions of the string", () => {
        const part = new StringOptionsSyntax(["ab", "abc", "ad", "bc"]);

        const suggestions = part.getSuggestions("a", 0)!;

        expect(suggestions.length).to.equal(3);
        expect(suggestions).to.deep.equal([
            { showAs: "abc", value: "abc" },
            { showAs: "ab", value: "ab" },
            { showAs: "ad", value: "ad" }
        ]);
    });

    it("should suggest completing a completed string", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        const suggestions = part.getSuggestions("ab", 0)!;

        expect(suggestions.length).to.equal(1);
        expect(suggestions[0].showAs).to.equal('ab');
        expect(suggestions[0].value).to.equal('ab');
    });

    it("should suggest completing the string at a given index", () => {
        const part = new StringOptionsSyntax(["ab", "bc"]);

        const suggestions = part.getSuggestions("prefix-on-a", 10)!;

        expect(suggestions.length).to.equal(1);
        expect(suggestions[0].showAs).to.equal('ab');
        expect(suggestions[0].value).to.equal('ab');
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

});