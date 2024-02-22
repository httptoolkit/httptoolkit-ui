import { reaction } from 'mobx';

import { RawHeaders } from '../../types';
import { getHeaderValue, setHeaderValue, removeHeader } from '../../util/headers';
import { EditableBody } from './editable-body';
import { EditableContentType, getDefaultMimeType, getEditableContentType } from '../events/content-types';

function getExpectedHost(url: string) {
    try {
        return new URL(url).host;
    } catch (e) {
        return undefined;
    }
}

/**
 * Whenever the observable result of getUrl changes, if the Host header in getHeaders was
 * previously in sync, we keep it in sync, updating the host header to match.
 */
export function syncUrlToHeaders(getUrl: () => string, getHeaders: () => RawHeaders) {
    const initialUrl = getUrl();

    // Track the previous value of the URL, so we know whether we were in sync before.
    let lastHost = getExpectedHost(initialUrl);
    // Undefined here ^ represents 'initially invalid URL' - we consider that updatable

    return reaction(() => getUrl(), (url) => {
        const headers = getHeaders();
        const hostHeader = getHeaderValue(headers, 'host') ?? '';

        const newHost = getExpectedHost(url);
        // Ignore intermediate invalid states - but if the URL is totally cleared, and was
        // in sync, then we do clear the host header too.

        // We only keep the host header in sync unless you change it. As soon as they're
        // out of sync, we just give up. Note that this does include unset/empty though,
        // to autopopulate the Host header right at the beginning.
        if (hostHeader === lastHost || lastHost === undefined) {
            if (newHost) {
                setHeaderValue(headers, 'host', newHost, { prepend: true });
            } else {
                removeHeader(headers, 'host');
            }
        }

        lastHost = newHost;
    });
}

function getFramingHeader(headers: RawHeaders): 'transfer-encoding' | 'content-length' | undefined {
    return getHeaderValue(headers, 'transfer-encoding')
        ? 'transfer-encoding'
    : getHeaderValue(headers, 'content-length')
        ? 'content-length'
    : undefined;
}

/**
 * Maintains the invariant of a content-length header matching the encoded body size.
 */
export function syncBodyToContentLength(body: EditableBody, getHeaders: () => RawHeaders) {
    // Track the last known length of the body. Undefined if we haven't yet seen an
    // encoded result (initial load).
    let lastBodyLength = body.latestEncodedLength;
    let initialEncodingPromise = body.encodingPromise;

    return reaction(() => body.latestEncodedLength, (bodyLength) => {
        // If this result is still from the initial encoding run when we were set up, then we
        // ignore it - we're only interested in updates _after_ we started syncing.
        if (initialEncodingPromise === body.encodingPromise) {
            lastBodyLength = bodyLength;
            return;
        }

        const headers = getHeaders();

        const framingHeader = getFramingHeader(headers);
        if (!bodyLength) {
            // The body has been removed - drop framing headers if present
            if (framingHeader) removeHeader(headers, framingHeader);
        } else if (!lastBodyLength) {
            // The first update to the body (initial load, or first character entered)
            if (!framingHeader || framingHeader === 'content-length') {
                setHeaderValue(headers, 'content-length', bodyLength.toString());
            }

            // If you already have framing, we can't have been in sync with that, so we don't touch it
        } else if (framingHeader === 'content-length') {
            // bodyLength + lastBodyLength => an update to an existing body while using content-length
            if (lastBodyLength === parseInt(getHeaderValue(headers, 'content-length')!)) {
                setHeaderValue(headers, 'content-length', bodyLength.toString());
            }
        } else {
            // For transfer-encoding we do nothing, once set it's valid for all values.
            // For no framing, we do nothing - it's odd, but it's still similarly valid for all values
        }

        lastBodyLength = bodyLength;
    });
}

export function syncFormattingToContentType(
    getHeaders: () => RawHeaders,
    getEditorFormatting: () => EditableContentType,
    setEditorFormatting: (format: EditableContentType) => void
) {
    let previousEditorFormat = getEditorFormatting();

    return [
        // If the content-type header changes to a known value, update the format to match:
        reaction(() => getHeaderValue(getHeaders(), 'content-type'), (contentTypeHeader) => {
            const detectedContentType = getEditableContentType(contentTypeHeader);
            if (detectedContentType) {
                setEditorFormatting(detectedContentType);
            }
            // If not a known type, we leave the content type as-is
        }),

        // If the content-type header was in sync, and the format changes, update the header:
        reaction(() => getEditorFormatting(), (newEditorFormat) => {
            const contentTypeHeader = getHeaderValue(getHeaders(), 'content-type');
            const impliedEditorFormat = getEditableContentType(contentTypeHeader);

            if (!contentTypeHeader || previousEditorFormat === impliedEditorFormat) {
                setHeaderValue(getHeaders(), 'content-type', getDefaultMimeType(newEditorFormat));
            }

            previousEditorFormat = newEditorFormat;
        })
    ];
}