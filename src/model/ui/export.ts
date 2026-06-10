import * as HTTPSnippet from "@httptoolkit/httpsnippet";

import { saveFile } from "../../util/ui";

import { HttpExchangeView } from "../../types";
import { generateHarRequest, generateHar } from '../http/har';
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
    // want to export it. All snippet-specific preprocessing (header filtering,
    // body placeholders) lives in snippet-export-sanitization.ts, so that this
    // export and the bulk ZIP export share identical behaviour:
    const harRequest = generateHarRequest(exchange.request, false, {
        bodySizeLimit: Infinity
    });
    const harSnippetBase = simplifyHarRequestForSnippetExport(harRequest);

    // Then, we convert that HAR to code for the given target:
    return new HTTPSnippet(harSnippetBase)
        .convert(snippetFormat.target, snippetFormat.client)
        .trim();
};