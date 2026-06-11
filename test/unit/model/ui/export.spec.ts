import { expect } from "../../../test-setup";

import { RequestInput } from "../../../../src/model/send/send-request-model";
import { generateCodeSnippetFromRequestInput } from "../../../../src/model/ui/export";
import { getCodeSnippetOptionFromKey } from "../../../../src/model/ui/snippet-formats";

const curlFormat = getCodeSnippetOptionFromKey('shell~~curl');

describe("Code snippet generation from Send request inputs", () => {

    it("should generate a curl snippet for a simple GET request", () => {
        const requestInput = new RequestInput({
            method: 'GET',
            url: 'https://example.com/path?a=b',
            headers: [
                ['host', 'example.com'],
                ['accept', 'application/json']
            ],
            requestContentType: 'text',
            rawBody: Buffer.from([])
        });

        const snippet = generateCodeSnippetFromRequestInput(requestInput, curlFormat);

        expect(snippet).to.include('curl');
        expect(snippet).to.include('https://example.com/path?a=b');
        expect(snippet).to.include("--header 'accept: application/json'");
    });

    it("should generate a curl snippet including the body for a POST request", () => {
        const requestInput = new RequestInput({
            method: 'POST',
            url: 'https://example.com/upload',
            headers: [
                ['host', 'example.com'],
                ['content-type', 'application/json'],
                ['content-length', '18']
            ],
            requestContentType: 'json',
            rawBody: Buffer.from('{"hello":"world"}')
        });

        const snippet = generateCodeSnippetFromRequestInput(requestInput, curlFormat);

        expect(snippet).to.include('--request POST');
        expect(snippet).to.include('https://example.com/upload');
        expect(snippet).to.include("--header 'content-type: application/json'");
        expect(snippet).to.include('{"hello":"world"}');

        // Content-length is dropped, as clients can calculate it themselves:
        expect(snippet).to.not.include('content-length');
    });

    it("should drop content-encoding headers and use the decoded body", () => {
        const requestInput = new RequestInput({
            method: 'POST',
            url: 'https://example.com/',
            headers: [
                ['host', 'example.com'],
                ['content-type', 'text/plain'],
                ['content-encoding', 'gzip']
            ],
            requestContentType: 'text',
            rawBody: Buffer.from('plain text body')
        });

        const snippet = generateCodeSnippetFromRequestInput(requestInput, curlFormat);

        expect(snippet).to.include('plain text body');
        expect(snippet).to.not.include('content-encoding');
    });

    it("should fail clearly given an invalid URL", () => {
        const requestInput = new RequestInput({
            method: 'GET',
            url: 'not-a-real-url',
            headers: [],
            requestContentType: 'text',
            rawBody: Buffer.from([])
        });

        expect(() =>
            generateCodeSnippetFromRequestInput(requestInput, curlFormat)
        ).to.throw();
    });

});
