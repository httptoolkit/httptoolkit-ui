import * as _ from 'lodash';

// Simplify a mime type as much as we can, without throwing any errors
export const getBaseContentType = (mimeType: string | undefined) =>
    (mimeType || '').split(';')[0].split('+')[0];

export type HtkContentType =
    | 'raw'
    | 'text'
    | 'json'
    | 'xml'
    | 'html'
    | 'css'
    | 'javascript'
    | 'markdown'
    | 'yaml'
    | 'image'

export function getHTKContentType(mimeType: string | undefined): HtkContentType {
    switch (getBaseContentType(mimeType)) {
        case 'application/json':
        case 'text/json':
            return 'json';

        case 'application/xml':
        case 'text/xml':
        case 'application/rss':
            return 'xml';

        case 'text/javascript':
        case 'application/javascript':
        case 'application/x-javascript':
        case 'application/ecmascript':
            return 'javascript';

        case 'text/plain':
        case 'text/csv':
        case 'application/x-www-form-urlencoded':
            return 'text';

        case 'text/markdown':
        case 'text/x-markdown':
            return 'markdown';

        case 'text/yaml':
        case 'text/x-yaml':
        case 'application/yaml':
            return 'yaml';

        case 'image/gif':
        case 'image/jpg':
        case 'image/jpeg':
        case 'image/png':
        case 'image/svg':
        case 'image/tiff':
        case 'image/webp':
        case 'image/x-icon':
        case 'image/vnd.microsoft.icon':
            return 'image';

        case 'text/css':
            return 'css';

        case 'text/html':
        case 'application/xhtml':
            return 'html';

        case 'application/octet-stream':
            return 'raw';

        default:
            return 'text';
    }
}

export function getCompatibleTypes(contentType: HtkContentType, rawContentType?: string): HtkContentType[] {
    let types = [contentType];

    // Anything except raw & image can be shown as text
    if (!_.includes(['raw', 'image', 'text'], contentType)) {
        types.push('text');
    }

    // SVGs can be shown as XML
    if (rawContentType && rawContentType.startsWith('image/svg')) {
        types.push('xml');
    }

    // Anything can be shown raw
    if (contentType !== 'raw') types.push('raw');

    return types;
}