import { reaction } from 'mobx';

import { RawHeaders } from '../../types';
import { getHeaderValue, setHeaderValue, removeHeader } from '../../util/headers';

export function getExpectedHost(url: string) {
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
    // Track the previous value of the URL, so we know whether we were in sync before.
    let lastHost: string | undefined; // Undefined means 'initially invalid URL' - we consider that updatable

    const initialUrl = getUrl();
    if (!initialUrl) lastHost = '';
    lastHost = getExpectedHost(initialUrl);

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