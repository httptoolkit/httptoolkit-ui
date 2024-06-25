import { expect } from "../../../test-setup";

import { escapeForMarkdownEmbedding, fromMarkdown } from "../../../../src/model/ui/markdown";

const escapeAndRender = (input: string) => {
    return fromMarkdown(escapeForMarkdownEmbedding(input)).__html
}

describe("Markdown content escaping", () => {
    it("should do nothing with plain text", () => {
        expect(
            escapeAndRender("Hello world! Do Markdown chars hy-phens and . still render OK?")
        ).to.equal("<p>Hello world! Do Markdown chars hy-phens and . still render OK?</p>")
    });

    it("should escape HTML tags", () => {
        expect(
            escapeAndRender("<i>Hello</i>")
        ).to.equal("<p>&lt;i&gt;Hello&lt;/i&gt;</p>");
    });

    it("should escape ampersands", () => {
        expect(
            escapeAndRender("This & that")
        ).to.equal("<p>This &amp; that</p>");
    });

    it("should escape Markdown bold/italic syntax", () => {
        expect(
            escapeAndRender("*italic* and **bold**")
        ).to.equal("<p>*italic* and **bold**</p>");
    });

    it("should escape Markdown link syntax", () => {
        expect(
            escapeAndRender("[link](/abc)")
        ).to.equal("<p>[link](/abc)</p>");
    });

    it("should escape Markdown code syntax", () => {
        expect(
            escapeAndRender("`code` and ```multiline code```")
        ).to.equal("<p>`code` and ```multiline code```</p>");
    });

    it("should escape Markdown headers", () => {
        expect(
            escapeAndRender("# Header")
        ).to.equal("<p># Header</p>");
    });

    it("should escape Markdown numerical lists", () => {
        expect(
            escapeAndRender("1. Item")
        ).to.equal("<p>1. Item</p>");
    });

    it("should escape Markdown blockquotes", () => {
        expect(
            escapeAndRender("> Blockquote")
        ).to.equal("<p>&gt; Blockquote</p>");
    });

    it("should escape Markdown horizontal rules", () => {
        expect(
            escapeAndRender("---")
        ).to.equal("<p>---</p>");
    });

    it("should handle mixed HTML and Markdown", () => {
        expect(
            escapeAndRender("<a href='#'>*Click* me</a>")
        ).to.equal("<p>&lt;a href='#'&gt;*Click* me&lt;/a&gt;</p>");
    });

    it("should handle already escaped characters", () => {
        expect(
            escapeAndRender("\\*already escaped\\*")
        ).to.equal("<p>\\*already escaped\\*</p>");
    });

    it("should handle Unicode characters", () => {
        expect(
            escapeAndRender("Unicode: ♥ λ")
        ).to.equal("<p>Unicode: ♥ λ</p>");
    });

});