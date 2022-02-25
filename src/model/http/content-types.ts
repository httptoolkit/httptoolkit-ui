import * as _ from 'lodash';
import { MessageBody } from '../../types';

// Simplify a mime type as much as we can, without throwing any errors
export const getBaseContentType = (mimeType: string | undefined) => {
    const typeWithoutParams = (mimeType || '').split(';')[0];
    const [type, combinedSubTypes] = typeWithoutParams.split(/\/(.+)/);

    if (!combinedSubTypes) return type;

    // A list of types from most specific to most generic: [svg, xml] for image/svg+xml
    const subTypes = combinedSubTypes.split('+');

    const possibleTypes = subTypes.map(st => type + '/' + st);
    return _.find(possibleTypes, t => !!mimeTypeToContentTypeMap[t]) ||
        _.last(possibleTypes)!; // If we recognize none - return the most generic
}

export type ViewableContentType =
    | 'raw'
    | 'text'
    | 'url-encoded'
    | 'base64'
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

    'application/x-www-form-urlencoded': 'url-encoded',

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
} as const;

export function getContentType(mimeType: string | undefined): ViewableContentType | undefined {
    const baseContentType = getBaseContentType(mimeType);
    return mimeTypeToContentTypeMap[baseContentType!];
}

export function getEditableContentType(mimeType: string | undefined): EditableContentType | undefined {
    const baseContentType = getBaseContentType(mimeType);
    const viewableContentType = mimeTypeToContentTypeMap[baseContentType!];

    if (EditableContentTypes.includes(viewableContentType as any)) {
        return viewableContentType as EditableContentType;
    }
}

export function getContentEditorName(contentType: ViewableContentType): string {
    return contentType === 'raw' ? 'Hex'
        : contentType === 'json' ? 'JSON'
        : contentType === 'url-encoded' ? 'URL-Encoded'
        : _.capitalize(contentType);
}

export function getDefaultMimeType(contentType: ViewableContentType): string {
    // Uses the *first* mime type listed for this key in our map
    return _.findKey(mimeTypeToContentTypeMap, (c) => c === contentType)!;
}

function isValidBase64Byte(byte: number) {
    return (byte >= 65 && byte <= 90) || // A-Z
        (byte >= 97 && byte <= 122) ||   // a-z
        (byte >= 48 && byte <= 57) ||    // 0-9
        byte === 43 ||                   // +
        byte === 47 ||                   // /
        byte === 61;                     // =
}

export function getCompatibleTypes(
    contentType: ViewableContentType,
    rawContentType: string | undefined,
    body: MessageBody
): ViewableContentType[] {
    let types = [contentType];

    // Examine the first char of the body, assuming it's ascii
    let firstChar = body.decoded && body.decoded.slice(0, 1).toString('ascii');

    // Allow formatting non-JSON text as JSON, if it looks like it might be
    if (contentType === 'text' && (firstChar === '{' || firstChar === '[')) {
        types.push('json');
    }

    // Allow formatting non-XML plain text as XML, if it looks like it might be
    if (contentType === 'text' && firstChar === '<') {
        types.push('xml');
    }

    // Pretty much anything can be shown as plain text, if you like
    if (!_.includes(['text'], contentType)) {
        types.push('text');
    }

    // SVGs can be shown as XML
    if (rawContentType && rawContentType.startsWith('image/svg')) {
        types.push('xml');
    }

    // Anything can be shown raw
    if (contentType !== 'raw') types.push('raw');

    if (
        body.decoded &&
        body.decoded.length > 0 &&
        body.decoded.length % 4 === 0 && // Multiple of 4 bytes
        body.decoded.length < 1000 * 100 && // < 100 KB of content
        body.decoded.every(isValidBase64Byte)
    ) {
        types.push('base64');
    }

    return types;
}