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
    | 'image';

const mimeTypeToContentTypeMap: { [mimeType: string]: HtkContentType } = {
    'application/json': 'json',
    'text/json': 'json',

    'application/xml': 'xml',
    'text/xml': 'xml',
    'application/rss': 'xml',

    'application/javascript': 'javascript',
    'application/x-javascript': 'javascript',
    'application/ecmascript': 'javascript',
    'text/javascript': 'javascript',

    'text/plain': 'text',
    'text/csv': 'text',
    'application/x-www-form-urlencoded': 'text',

    'text/markdown': 'markdown',
    'text/x-markdown': 'markdown',

    'text/x-yaml': 'yaml',
    'text/yaml': 'yaml',
    'application/yaml': 'yaml',

    'image/png': 'image',
    'image/gif': 'image',
    'image/jpg': 'image',
    'image/jpeg': 'image',
    'image/svg': 'image',
    'image/tiff': 'image',
    'image/webp': 'image',
    'image/x-icon': 'image',
    'image/vnd.microsoft.icon': 'image',

    'text/css': 'css',

    'text/html': 'html',
    'application/xhtml': 'html',

    'application/octet-stream': 'raw'
};

export function getHTKContentType(mimeType: string | undefined): HtkContentType | undefined {
    const baseContentType = getBaseContentType(mimeType);
    return mimeTypeToContentTypeMap[baseContentType];
}

export function getDefaultMimeType(contentType: HtkContentType): string {
    // Uses the *first* mime type listed for this key in our map
    return _.findKey(mimeTypeToContentTypeMap, (c) => c === contentType)!;
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