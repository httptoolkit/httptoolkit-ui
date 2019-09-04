import * as _ from 'lodash';

// Simplify a mime type as much as we can, without throwing any errors
export const getBaseContentType = (mimeType: string | undefined) =>
    (mimeType || '').split(';')[0].split('+')[0];

export type ViewableContentType =
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

export const EditableContentTypes = [
    'text',
    'json',
    'xml',
    'html',
    'css',
    'javascript'
] as const;

export type EditableContentType = (
    typeof EditableContentTypes
) extends ReadonlyArray<infer T> ? T : never;

const mimeTypeToContentTypeMap: { [mimeType: string]: ViewableContentType } = {
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

export function getContentType(mimeType: string | undefined): ViewableContentType | undefined {
    const baseContentType = getBaseContentType(mimeType);
    return mimeTypeToContentTypeMap[baseContentType];
}

export function getEditableContentType(mimeType: string | undefined): EditableContentType | undefined {
    const baseContentType = getBaseContentType(mimeType);
    const viewableContentType = mimeTypeToContentTypeMap[baseContentType];

    if (EditableContentTypes.includes(viewableContentType as any)) {
        return viewableContentType as EditableContentType;
    }
}

export function getContentEditorName(contentType: ViewableContentType): string {
    return contentType === 'raw' ? 'Hex'
        : contentType === 'json' ? 'JSON'
        : _.capitalize(contentType);
}

export function getDefaultMimeType(contentType: ViewableContentType): string {
    // Uses the *first* mime type listed for this key in our map
    return _.findKey(mimeTypeToContentTypeMap, (c) => c === contentType)!;
}

export function getCompatibleTypes(contentType: ViewableContentType, rawContentType?: string): ViewableContentType[] {
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