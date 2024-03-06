import * as _ from 'lodash';
import { MessageBody } from '../../types';
import {
    isProbablyProtobuf,
    isValidProtobuf
} from '../../util/protobuf';

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
    | 'image'
    | 'protobuf';

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
    'image/avif': 'image',
    'image/x-icon': 'image',
    'image/vnd.microsoft.icon': 'image',

    'text/css': 'css',

    'text/html': 'html',
    'application/xhtml': 'html',

    'application/protobuf': 'protobuf',
    'application/x-protobuf': 'protobuf',
    'application/vnd.google.protobuf': 'protobuf',
    'application/x-google-protobuf': 'protobuf',
    'application/proto': 'protobuf',

    'application/octet-stream': 'raw'
} as const;

export function getContentType(mimeType: string | undefined): ViewableContentType | undefined {
    const baseContentType = getBaseContentType(mimeType);
    return mimeTypeToContentTypeMap[baseContentType!];
}

export function getEditableContentTypeFromViewable(contentType: ViewableContentType): EditableContentType | undefined {
    if (EditableContentTypes.includes(contentType as any)) {
        return contentType as EditableContentType;
    }
}

export function getEditableContentType(mimeType: string | undefined): EditableContentType | undefined {
    const baseContentType = getBaseContentType(mimeType);
    const viewableContentType = mimeTypeToContentTypeMap[baseContentType!];
    return getEditableContentTypeFromViewable(viewableContentType);
}

export function getContentEditorName(contentType: ViewableContentType): string {
    return contentType === 'raw' ? 'Hex'
        : contentType === 'json' ? 'JSON'
        : contentType === 'css' ? 'CSS'
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
    body: MessageBody | Buffer | undefined
): ViewableContentType[] {
    let types = new Set([contentType]);

    if (body && !Buffer.isBuffer(body)) {
        body = body.decoded;
    }

    // Examine the first char of the body, assuming it's ascii
    const firstChar = body && body.slice(0, 1).toString('ascii');

    // Allow optionally formatting non-JSON as JSON, if it looks like it might be
    if (firstChar === '{' || firstChar === '[') {
        types.add('json');
    }

    // Allow optionally formatting non-XML as XML, if it looks like it might be
    if (firstChar === '<') {
        types.add('xml');
    }

    if (
        body &&
        isProbablyProtobuf(body) &&
        !types.has('protobuf') &&
        // If it's probably unmarked protobuf, and it's a manageable size, try
        // parsing it just to check:
        (body.length < 100_000 && isValidProtobuf(body))
    ) {
        types.add('protobuf');
    }

    // SVGs can always be shown as XML
    if (rawContentType && rawContentType.startsWith('image/svg')) {
        types.add('xml');
    }

    if (
        body &&
        body.length > 0 &&
        body.length % 4 === 0 && // Multiple of 4 bytes
        body.length < 1000 * 100 && // < 100 KB of content
        body.every(isValidBase64Byte)
    ) {
        types.add('base64');
    }

    // Lastly, anything can be shown raw or as text, if you like:
    types.add('text');
    types.add('raw');

    return Array.from(types);
}