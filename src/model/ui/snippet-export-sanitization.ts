import type * as HarFormat from 'har-format';

/**
 * Shared snippet-export sanitizing rules.
 *
 * This module is safe to import from both the browser UI and the web worker.
 */
type SnippetHeaderLike = Pick<HarFormat.Header, 'name' | 'value'>;

const HOP_BY_HOP_HEADERS = new Set<string>([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'content-length',
    'content-encoding'
]);

function getConnectionListedHeaderNames(
    headers: readonly SnippetHeaderLike[]
): ReadonlySet<string> {
    const connectionListedHeaders = new Set<string>();

    for (const header of headers) {
        if ((header?.name ?? '').toLowerCase() !== 'connection') continue;

        for (const token of String(header?.value ?? '').split(',')) {
            const normalized = token.trim().toLowerCase();
            if (normalized) connectionListedHeaders.add(normalized);
        }
    }

    return connectionListedHeaders;
}

export function isDroppableSnippetHeader(
    name: string | undefined | null,
    connectionListedHeaders: ReadonlySet<string> = new Set()
): boolean {
    if (!name) return true;
    if (name.startsWith(':')) return true;

    const lower = name.toLowerCase();
    return HOP_BY_HOP_HEADERS.has(lower) || connectionListedHeaders.has(lower);
}

export function filterHeadersForSnippetExport<T extends SnippetHeaderLike>(
    headers: readonly T[] | undefined
): T[] {
    const inputHeaders = headers || [];
    const connectionListedHeaders = getConnectionListedHeaderNames(inputHeaders);

    return inputHeaders.filter((header) =>
        !isDroppableSnippetHeader(header?.name, connectionListedHeaders)
    );
}

/**
 * Sanitize a HAR request for snippet export without changing its effective
 * payload. In particular, keep raw `postData.text` even when `params` are
 * present, so ZIP export stays aligned with single-request export.
 */
export function simplifyHarEntryRequestForSnippetExport(
    harRequest: HarFormat.Request
): HarFormat.Request {
    const headers = filterHeadersForSnippetExport(harRequest.headers);
    const queryString = (harRequest.queryString || []).filter(
        (q) => (q?.name ?? '') !== '' || (q?.value ?? '') !== ''
    );

    let postData = harRequest.postData;
    if (postData && 'text' in postData) {
        postData = {
            ...postData,
            text: postData.text ?? ''
        } as HarFormat.PostData;
    }

    return {
        ...harRequest,
        headers,
        queryString,
        cookies: [],
        postData
    };
}
