import { expect } from "chai";
import * as monaco from 'monaco-editor';

import {
    validateJsonRecords,
    validateXml
} from "../../../../src/model/events/content-validation";

const contentModel = (content: string) => monaco.editor.createModel(content, "json-records");

describe("XML validation", () => {
    it("should validate correct XML", () => {
        const text = `<root><child>Content</child></root>`;
        const markers = validateXml(text);
        expect(markers).to.deep.equal([]);
    });

    it("should reject incorrect XML", () => {
        const text = `<root>
            <child>Content</child>
        </wrong>`;
        const markers = validateXml(text);
        expect(markers).to.deep.equal([
            {
                severity: 8,
                message: "Expected closing tag 'root' (opened in line 1, col 1) instead of closing tag 'wrong'.",
                startLineNumber: 3,
                endLineNumber: 3,
                startColumn: 9,
                endColumn: Infinity
            }
        ]);
    });
})

describe("JSON Records Validation", () => {
    it("should validate correct normal JSON", () => {
        const text = '{"name":"John"}';
        const markers = validateJsonRecords(text, contentModel(text));
        expect(markers).to.deep.equal([]);
    });

    it("should validate correct JSON records", () => {
        const text = '{"name":"John"}\n\u001E\n{"name":"Jane"}';
        const markers = validateJsonRecords(text, contentModel(text));
        expect(markers).to.deep.equal([]);
    });

    it("should reject incorrect JSON", () => {
        const text = '{"name":}';
        const markers = validateJsonRecords(text, contentModel(text));
        expect(markers).to.deep.equal([
            {
                severity: 8,
                message: "Value expected",
                startLineNumber: 1,
                startColumn: 9,
                endLineNumber: 1,
                endColumn: 10
            }
        ]);
    });

    it("should reject incorrect record-separator JSON records", () => {
        const text = '\u001E{"name":"John"}\u001E{"name":}';
        const markers = validateJsonRecords(text, contentModel(text));
        expect(markers).to.deep.equal([
            {
                severity: 8,
                message: "Value expected",
                startLineNumber: 1,
                startColumn: 26,
                endLineNumber: 1,
                endColumn: 27
            }
        ]);
    });

    it("should reject incorrect newline-separator JSON records", () => {
        const text = '{"name":"John"}\n{"name":}';
        const markers = validateJsonRecords(text, contentModel(text));
        expect(markers).to.deep.equal([
            {
                severity: 8,
                message: "Value expected",
                startLineNumber: 2,
                startColumn: 9,
                endLineNumber: 2,
                endColumn: 10
            }
        ]);
    });

    it("should reject incorrect record-separator JSON records with newlines separators too", () => {
        const text = '\n{"name":"John"}\n\u001E\n{"name":}\n';
        const markers = validateJsonRecords(text, contentModel(text));
        expect(markers).to.deep.equal([
            {
                severity: 8,
                message: "Value expected",
                startLineNumber: 4,
                startColumn: 9,
                endLineNumber: 4,
                endColumn: 10
            }
        ]);
    });

    it("should reject incorrect JSON records with good line numbers despite spurious newlines", () => {
        const text = '\n{"name":\n\n"John"\n}\n\u001E\n\u001E\n{"name":}';
        const markers = validateJsonRecords(text, contentModel(text));
        expect(markers).to.deep.equal([
            {
                severity: 8,
                message: "Value expected",
                startLineNumber: 8,
                startColumn: 9,
                endLineNumber: 8,
                endColumn: 10
            }
        ]);
    });
});