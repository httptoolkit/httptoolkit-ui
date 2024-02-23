import * as _ from 'lodash';
import * as HTTPSnippet from "@httptoolkit/httpsnippet";

import { saveFile } from "../../util/ui";
import { ObservablePromise } from '../../util/observable';

import { HttpExchange } from "../http/exchange";
import { generateHarRequest, generateHar, ExtendedHarRequest } from '../http/har';

export const exportHar = async (exchange: HttpExchange) => {
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
    exchange: HttpExchange,
    snippetFormat: SnippetOption,
    options: { waitForBodyDecoding: true }
): ObservablePromise<string>;
export function generateCodeSnippet(
    exchange: HttpExchange,
    snippetFormat: SnippetOption,
    options?: { waitForBodyDecoding?: boolean }
): string;
export function generateCodeSnippet(
    exchange: HttpExchange,
    snippetFormat: SnippetOption,
    options: { waitForBodyDecoding?: boolean } = {}
): string | ObservablePromise<string> {
    // If the body isn't decoded yet, and it should be, wait for that decoding first.
    if (options.waitForBodyDecoding && (
        exchange.request.body.decodedPromise.state === 'pending' ||
        exchange.request.body.decodedPromise.state === undefined
    )) {
        // Doesn't matter if this errors - we'll make that explicit in the export later.
        return exchange.request.body.decodedPromise.catch(() => {})
            .then(() => generateCodeSnippet(exchange, snippetFormat, options));
    }

    // First, we need to get a HAR that appropriately represents this request as we
    // want to export it:
    const harRequest = generateHarRequest(exchange.request, false, {
        bodySizeLimit: Infinity
    });
    const harSnippetBase = simplifyHarForSnippetExport(harRequest);

    // Then, we convert that HAR to code for the given target:
    return new HTTPSnippet(harSnippetBase).convert(snippetFormat.target, snippetFormat.client);
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

    // When exporting code snippets the primary goal is to generate convenient code to send the
    // request that's *sematantically* equivalent to the original request, not to force every
    // tool to produce byte-for-byte identical requests (that's effectively impossible). To do
    // this, we drop headers that tools can produce automatically for themselves:
    return {
        ...harRequest,
        postData,
        headers: harRequest.headers.filter((header) => {
            // All clients should be able to automatically generate the correct content-length
            // headers as required for a request where it's unspecified. If we override this,
            // it can cause problems if tools change the body length (due to encoding/compression).
            if (header.name.toLowerCase() === 'content-length') return false;

            // HTTP/2 headers should never be included in snippets - they're implicitly part of
            // the other request data (the method etc).
            // We can drop this after fixing https://github.com/Kong/httpsnippet/issues/298
            if (header.name.startsWith(':')) return false;

            // The body data in the HAR (and therefore the snippet) is always the _decoded_ data,
            // and encoded data is often not representable directly as a string anyway. Fortunately,
            // request bodies are rarely encoded. In the rare cases that they are, we just drop the
            // encoding header and send the decoded body directly instead. Not perfect, but it
            // should be semantically equivalent, and the only alternative is embedding encoded data
            // in snippets (messy, confusing, hard to edit) or adding encoding logic to every kind
            // of snippet we can produce for every encoding you could use (difficult/impossible)
            if (header.name.toLowerCase() === 'content-encoding') return false;

            return true;
        })
    };
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