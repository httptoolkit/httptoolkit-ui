import type * as HarFormat from 'har-format';

/**
 * Shared HAR-request preprocessing for code snippet exports. Used by both
 * the single-snippet export (model/ui/export.ts) and the bulk ZIP export
 * worker, so that both produce identical snippets for the same request.
 */
export function simplifyHarRequestForSnippetExport<T extends HarFormat.Request>(
    harRequest: T
): T {
    // When exporting code snippets the primary goal is to generate convenient code to send the
    // request that's *semantically* equivalent to the original request, not to force every
    // tool to produce byte-for-byte identical requests (that's effectively impossible). To do
    // this, we drop headers that tools can produce automatically for themselves:
    return {
        ...harRequest,
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
        }),
        cookies: [] // There are included separately in the headers, it's unhelpful to duplicate that
    };
}
