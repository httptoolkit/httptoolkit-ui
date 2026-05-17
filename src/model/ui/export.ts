import * as _ from 'lodash';
import * as HTTPSnippet from "@httptoolkit/httpsnippet";

import { saveFile } from "../../util/ui";

import { HttpExchangeView } from "../../types";
import { generateHarRequest, generateHar, ExtendedHarRequest } from '../http/har';
import { simplifyHarRequestForSnippetExport } from './snippet-export-sanitization';

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
    const harSnippetBase = simplifyHarForSnippetExport(harRequest);

    // Then, we convert that HAR to code for the given target:
    return new HTTPSnippet(harSnippetBase)
        .convert(snippetFormat.target, snippetFormat.client)
        .trim();
};

const simplifyHarForSnippetExport = (harRequest: ExtendedHarRequest) => {
    const postData = !!harRequest.postData
            ? harRequest.postData
        : harRequest._requestBodyStatus === 'discarded:not-representable'
            ? {
                mimeType: 'text/plain',
                text: "!!! UNREPRESENTABLE BINARY REQUEST BODY - BODY MUST BE EXPORTED SEPARATELY !!!"
            }
        : harRequest._requestBodyStatus === 'discarded:too-large'
            ? {
                mimeType: 'text/plain',
                text: "!!! VERY LARGE REQUEST BODY - BODY MUST BE EXPORTED & INCLUDED SEPARATELY !!!"
            }
        : harRequest._requestBodyStatus === 'discarded:not-decodable'
            ? {
                mimeType: 'text/plain',
                text: "!!! REQUEST BODY COULD NOT BE DECODED !!!"
            }
        : undefined;

    // The header-filtering rules live in snippet-export-sanitization.ts, so
    // that this export and the bulk ZIP export share identical behaviour:
    return simplifyHarRequestForSnippetExport({
        ...harRequest,
        postData
    });
};

export interface SnippetOption {
    target: HTTPSnippet.Target,
    client: HTTPSnippet.Client,
    name: string,
    description: string,
    link: string
}

export const snippetExportOptions: _.Dictionary<SnippetOption[]> = _(HTTPSnippet.availableTargets())
    .keyBy(target => target.title)
    .mapValues(target =>
        target.clients.map((client) => ({
            target: target.key,
            client: client.key,
            name: client.title,
            description: client.description,
            link: client.link
        }))
    ).value();

const EXPORT_SNIPPET_KEY_SEPARATOR = '~~';

export const DEFAULT_SNIPPET_FORMAT_KEY = `shell${EXPORT_SNIPPET_KEY_SEPARATOR}curl`;

export const getCodeSnippetFormatKey = (option: SnippetOption) =>
    option.target + EXPORT_SNIPPET_KEY_SEPARATOR + option.client;

export const getCodeSnippetOptionFromKey = (key: string) => {
    const [target, client] = key.split(EXPORT_SNIPPET_KEY_SEPARATOR) as
        [HTTPSnippet.Target, HTTPSnippet.Client];

    return _(snippetExportOptions)
        .values()
        .flatten()
        .find({ target, client }) as SnippetOption;
};


// Show the client name, or an overridden name in some ambiguous cases
export const getCodeSnippetFormatName = (option: SnippetOption) => ({
    'php~~curl': 'PHP ext-cURL',
    'php~~http1': 'PHP HTTP v1',
    'php~~http2': 'PHP HTTP v2',
    'node~~native': 'Node.js HTTP'
} as _.Dictionary<string>)[getCodeSnippetFormatKey(option)] || option.name;