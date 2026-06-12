import type * as HarFormat from 'har-format';
import type { ExtendedHarRequest } from '../http/har';

/**
 * Shared HAR-request preprocessing for code snippet exports. Used by both
 * the single-snippet export (model/ui/export.ts) and the bulk ZIP export
 * worker, so that both produce identical snippets for the same request.
 */
export function simplifyHarRequestForSnippetExport(
    harRequest: ExtendedHarRequest
): ExtendedHarRequest {
    // Bodies that couldn't be included in the HAR directly (binary content,
    // undecodable data, or bodies over the HAR's size limit) have no
    // postData, just a _requestBodyStatus flag. For snippets we map those to
    // explicit placeholder text, so that the generated code never silently
    // omits a body that really exists:
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
    // request that's *semantically* equivalent to the original request, not to force every
    // tool to produce byte-for-byte identical requests (that's effectively impossible). To do
    // this, we drop headers that tools can produce automatically for themselves:
    return {
        ...harRequest,
        postData,
        headers: harRequest.headers.filter((header: HarFormat.Header) => {
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
