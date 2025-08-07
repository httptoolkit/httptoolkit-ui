import { expect } from "chai";

import { formatJson } from "../../../src/util/json";

describe("JSON formatting", () => {

    describe("given valid JSON", () => {
        it("should format a simple object", () => {
            const input = '{"b":2,"a":1}';
            const expected = `{
  "b": 2,
  "a": 1
}`;
            expect(formatJson(input)).to.equal(expected);
        });

        it("should correctly format an object with various data types", () => {
            const input = '{"str":"hello world","num":-123.45,"bool":false,"n":null,"emp_str":""}';
            const expected = `{
  "str": "hello world",
  "num": -123.45,
  "bool": false,
  "n": null,
  "emp_str": ""
}`;
            expect(formatJson(input)).to.equal(expected);
        });

        it("should correctly format an array with mixed data types", () => {
            const input = '["a string",-123.45,false,null,{"key":"value"},["nested"]]';
            const expected = `[
  "a string",
  -123.45,
  false,
  null,
  {
    "key": "value"
  },
  [
    "nested"
  ]
]`;
            expect(formatJson(input)).to.equal(expected);
        });

        it("should correctly format strings with escaped characters", () => {
            const input = '{"path":"C:\\\\Users\\\\Test","quote":"\\"hello\\""}';
            const expected = `{
  "path": "C:\\\\Users\\\\Test",
  "quote": "\\"hello\\""
}`;
            expect(formatJson(input)).to.equal(expected);
        });

        it("should handle deeply nested structures correctly", () => {
            const input = '{"a":{"b":{"c":{"d":[1,{"e":2},3]}}}}';
            const expected = `{
  "a": {
    "b": {
      "c": {
        "d": [
          1,
          {
            "e": 2
          },
          3
        ]
      }
    }
  }
}`;
            expect(formatJson(input)).to.equal(expected);
        });

        it("should normalize inconsistent whitespace and newlines", () => {
            const input = `
                {
            "a" :   1,
                "b" : [   2,
            3   ]
        }
                `;
            const expected = `{
  "a": 1,
  "b": [
    2,
    3
  ]
}`;
            expect(formatJson(input)).to.equal(expected);
        });
    });

    describe("given invalid JSON", () => {

        it("should preserve missing quotes", () => {
            const invalidInput = '{a: 1}';
            const expected = `{
  a: 1
}`;
            expect(() => formatJson(invalidInput)).to.not.throw();
            expect(formatJson(invalidInput)).to.equal(expected);
        });

        it("should preserve single quotes", () => {
            const invalidInput = '{\'a\': 1}';
            const expected = `{
  'a': 1
}`;
            expect(() => formatJson(invalidInput)).to.not.throw();
            expect(formatJson(invalidInput)).to.equal(expected);
        });

        it("should preserve a trailing comma", () => {
            const input = '{"a":1, "b":2,}';
            const expected = `{
  "a": 1,
  "b": 2,
}`;
            expect(formatJson(input)).to.equal(expected);
        });

        it("should preserve a single-line comment at the end of a line", () => {
            const input = '{"a": 1, // My line comment\n"b": 2}';
            const expected = `{
  "a": 1, // My line comment
  "b": 2
}`;
            expect(formatJson(input)).to.equal(expected);
        });

        it("should preserve a block comment at the end of a line", () => {
            const input = '{"a": 1 /* comment */, "b": 2}';
            const expected = `{
  "a": 1 /* comment */,
  "b": 2
}`;
            expect(formatJson(input)).to.equal(expected);
        });

        it("should preserve a block comment before a closing brace", () => {
            const input = '{ "a": 1 /* final comment */ }';
            const expected = `{
  "a": 1 /* final comment */
}`;
            expect(formatJson(input)).to.equal(expected);
        });

        it("should preserve both single-line and block comments", () => {
            const input = `{
                // This is a comment to be kept
                "a": 1, /* This should be kept */
                "b": 2 // This should also be kept
            }`;
            const expected = `{
  // This is a comment to be kept
  "a": 1, /* This should be kept */
  "b": 2 // This should also be kept
}`;
            expect(formatJson(input)).to.equal(expected);
        });

        it("should preserve a trailing comma when followed by comments", () => {
            const input = '{"a":1, "b":2, // trailing comma\n}';
            const expected = `{
  "a": 1,
  "b": 2, // trailing comma
}`;
            expect(formatJson(input)).to.equal(expected);
        });

        it("should format lines correctly despite a missing comma between object properties", () => {
        const input = '{"a": 1 "b": 2}';
        const expected = `{
  "a": 1
  "b": 2
}`;
            expect(formatJson(input)).to.equal(expected);
        });

        it("should format lines correctly despite a missing comma between array elements", () => {
            const input = '[1 "a" false]';
            const expected = `[
  1
  "a"
  false
]`;
            expect(formatJson(input)).to.equal(expected);
        });

        it("should preserve multiple consecutive or trailing commas", () => {
            const input = '{"a":1,,"b":2,,}';
            const expected = `{
  "a": 1,,
  "b": 2,,
}`;
            expect(formatJson(input)).to.equal(expected);
        });

        it("should format an unclosed object without adding the closing brace", () => {
            const input = '{"a": 1, "b": 2';
            const expected = `{
  "a": 1,
  "b": 2`;
            expect(formatJson(input)).to.equal(expected);
        });

        it("should format an unclosed array without adding the closing bracket", () => {
            const input = '[1, {"a": 2';
            const expected = `[
  1,
  {
    "a": 2`;
            expect(formatJson(input)).to.equal(expected);
        });

        it("should handle overly closed JSON (negative indents)", () => {
            const input = '{}}} []]]';
            const expected = `{}
}
}
[]
]
]
`;
            expect(formatJson(input)).to.equal(expected);
        });

        it("should not format complicated JSON records at all if formatRecords is false", () => {
            const input = '\u001E{"a":1}\n\u001Enull\n\u001Etrue\n\u001E"hi"\n\u001E[1,2,3]\n\u001E{"b":2}\n';
            const expected = `\u001E{
  "a": 1
}\u001Enull\u001Etrue\u001E"hi"\u001E[
  1,
  2,
  3
]\u001E{
  "b": 2
}`;
            expect(formatJson(input, { formatRecords: false })).to.equal(expected);
        });
    });

    describe("with record formatting enabled", () => {

        it("should correctly format newline-separated JSON records", () => {
            const input = '{"a":1}\n{"b":2}';
            const expected = `{
  "a": 1
}
{
  "b": 2
}`;
            expect(formatJson(input, { formatRecords: true })).to.equal(expected);
        });

        it("should correctly format newline-separated JSON records with weird newlines", () => {
            const input = '\n{\n"a"\n:1}\r\n\n\n{\n"b"\n:\n2\r}\n\r\n';
            const expected = `{
  "a": 1
}
{
  "b": 2
}`;
            expect(formatJson(input, { formatRecords: true })).to.equal(expected);
        });

        it("should correctly format record-separator-separated JSON records (SignalR style)", () => {
            const input = '{"a":1}\u001E{"b":2}';
            const expected = `{
  "a": 1
}
{
  "b": 2
}`;
            expect(formatJson(input, { formatRecords: true })).to.equal(expected);
        });

        it("should correctly format heavily record-separator-separated JSON records", () => {
            const input = '\u001E\u001E{"a":1}\u001E\u001E{"b":2}\u001E';
            const expected = `{
  "a": 1
}
{
  "b": 2
}`;
            expect(formatJson(input, { formatRecords: true })).to.equal(expected);
        });

        it("should correctly format heavily record-separator-separated JSON records with funky newlines", () => {
            const input = '\r\n\u001E\n{"a":1}\n\u001E{"b":2}\n\u001E';
            const expected = `{
  "a": 1
}
{
  "b": 2
}`;
            expect(formatJson(input, { formatRecords: true })).to.equal(expected);
        });

        it("should correctly format record-separator-separated JSON records with literal values (json-seq style)", () => {
            const input = '\u001E{"a":1}\n\u001Enull\n\u001Etrue\n\u001E"hi"\n\u001E[1,2,3]\n\u001E{"b":2}\n';
            const expected = `{
  "a": 1
}
null
true
"hi"
[
  1,
  2,
  3
]
{
  "b": 2
}`;
            expect(formatJson(input, { formatRecords: true })).to.equal(expected);
        });

        it("should still correctly format an array with mixed data types", () => {
            const input = '["a string",-123.45,false,null,{"key":"value"},["nested"]]';
            const expected = `[
  "a string",
  -123.45,
  false,
  null,
  {
    "key": "value"
  },
  [
    "nested"
  ]
]`;
            expect(formatJson(input, { formatRecords: true })).to.equal(expected);
        });

    });

});