import * as HTTPSnippet from "@httptoolkit/httpsnippet";

import { saveFile } from "../../util/ui";

import { HttpExchangeView } from "../../types";
import {
    generateHarRequest,
    generateHar,
    ExtendedHarRequest
} from '../http/har';
import { buildHtkRequest } from '../http/http-exchange';
import { RequestInput, buildSentExchangeRequest } from '../send/send-request-model';
import { simplifyHarRequestForSnippetExport } from './snippet-export-sanitization';
import { SnippetOption } from './snippet-formats';

export const exportHar = async (exchange: HttpExchangeView) => {
    const harContent = JSON.stringify(
        await generateHar([exchange], {
            bodySizeLimit: Infinity
        })
    );
    const filename = `${
        exchange.request.method
    } ${
        exchange.request.parsedUrl.hostname
    }.har`;

    saveFile(filename, 'application/har+json;charset=utf-8', harContent);
};

export function generateCodeSnippet(
    exchange: HttpExchangeView,
    snippetFormat: SnippetOption,
    options: { waitForBodyDecoding: true }
): Promise<string>;
export function generateCodeSnippet(
    exchange: HttpExchangeView,
    snippetFormat: SnippetOption,
    options?: { waitForBodyDecoding?: boolean }
): string;
export function generateCodeSnippet(
    exchange: HttpExchangeView,
    snippetFormat: SnippetOption,
    options: { waitForBodyDecoding?: boolean } = {}
): string | Promise<string> {
    // If the body isn't decoded yet, and it should be, wait for that decoding first.
    if (options.waitForBodyDecoding && exchange.request.body.isPending()) {
        // Doesn't matter if this errors - we'll make that explicit in the export later.
        return exchange.request.body.waitForDecoding().catch(() => {})
            .then(() => generateCodeSnippet(exchange, snippetFormat, options));
    }

    // First, we need to get a HAR that appropriately represents this request as we
    // want to export it:
    const harRequest = generateHarRequest(exchange.request, false, {
        bodySizeLimit: Infinity
    });

    return generateCodeSnippetFromHarRequest(harRequest, snippetFormat);
};

// Generates a code snippet for a not-yet-sent request input, e.g. while editing
// a request on the Send page. We build the same HtkRequest a real send would produce,
// so this goes through exactly the same HAR generation as exported captured requests.
export function generateCodeSnippetFromRequestInput(
    requestInput: RequestInput,
    snippetFormat: SnippetOption
): string {
    const decoded = requestInput.rawBody.decoded;
    const sentRequest = buildSentExchangeRequest(requestInput, {
        encodedLength: decoded.byteLength,
        decoded
    });

    const harRequest = generateHarRequest(buildHtkRequest(sentRequest), false, {
        bodySizeLimit: Infinity
    });

    return generateCodeSnippetFromHarRequest(harRequest, snippetFormat);
};

function generateCodeSnippetFromHarRequest(
    harRequest: ExtendedHarRequest,
    snippetFormat: SnippetOption
): string {
    // All snippet-specific preprocessing (header filtering, body placeholders) lives in
    // snippet-export-sanitization.ts, so that this export and the bulk ZIP export share
    // identical behaviour:
    const harSnippetBase = simplifyHarRequestForSnippetExport(harRequest);

    // We convert the HAR to code for the given target:
    return new HTTPSnippet(harSnippetBase)
        .convert(snippetFormat.target, snippetFormat.client)
        .trim();
};
