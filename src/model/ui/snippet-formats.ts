import * as _ from 'lodash';
import * as HTTPSnippet from '@httptoolkit/httpsnippet';

// The available code snippet export formats, derived directly from
// HTTPSnippet's own list of targets & clients.
//
// This module must stay free of main-thread dependencies (DOM, stores,
// etc) as it's also imported by the UI web worker.

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
