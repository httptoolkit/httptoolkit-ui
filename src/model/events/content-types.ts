import * as _ from 'lodash';

import { Headers, MessageBody } from '../../types';
import {
    isProbablyProtobuf,
    isValidProtobuf,
    isProbablyGrpcProto,
    isValidGrpcProto,
} from '../../util/protobuf';
import { isProbablyJson, isProbablyJsonRecords } from '../../util/json';
import { isProbablyUtf8 } from '../../util/buffer';

// Simplify a mime type as much as we can, without throwing any errors
export const getBaseContentType = (mimeType: string | undefined) => {
    const typeWithoutParams = (mimeType || '').split(';')[0];

    let [type, combinedSubTypes] = typeWithoutParams.split(/\/(.+)/);
    if (!combinedSubTypes) return type;

    if (DEFAULT_SUBTYPE[combinedSubTypes]) {
        combinedSubTypes = `${combinedSubTypes}+${DEFAULT_SUBTYPE[combinedSubTypes]}`;
    }

    // If this is a known type with an exact match, return that directly:
    if (mimeTypeToContentTypeMap[type + '/' + combinedSubTypes]) {
        return type + '/' + combinedSubTypes;
    }

    // Otherwise, we collect a list of types from most specific to most generic: [svg, xml] for image/svg+xml
    // and then look through in order to see if there are any matches here:
    const subTypes = combinedSubTypes.split('+');
    const possibleTypes = subTypes.map(st => type + '/' + st);

    return _.find(possibleTypes, t => !!mimeTypeToContentTypeMap[t]) || // Subtype match
        _.last(possibleTypes)!; // If we recognize none - return the most generic
}

const DEFAULT_SUBTYPE: { [type: string]: string } = {
    'grpc': 'proto' // Protobuf is the default gRPC content type (but not the only one!)
};

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
    | 'protobuf'
    | 'grpc-proto'
    | 'json-records'
    ;

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
    'application/proto': 'protobuf', // N.b. this covers all application/XXX+proto values
    'application/x-protobuffer': 'protobuf', // Commonly seen in Google apps

    'application/grpc+proto': 'grpc-proto', // Used in GRPC requests (protobuf but with special headers)
    'application/grpc+protobuf': 'grpc-proto',
    'application/grpc-proto': 'grpc-proto',
    'application/grpc-protobuf': 'grpc-proto',

    // Nobody can quite agree on the names for the various sequence-of-JSON formats:
    'application/jsonlines': 'json-records',
    'application/json-lines': 'json-records',
    'application/x-jsonlines': 'json-records',
    'application/jsonl': 'json-records',
    'application/x-ndjson': 'json-records',
    'application/json-seq': 'json-records',

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
        : contentType === 'json-records' ? 'JSON Records'
        : contentType === 'json' ? 'JSON'
        : contentType === 'css' ? 'CSS'
        : contentType === 'url-encoded' ? 'URL-Encoded'
        : contentType === 'grpc-proto' ? 'gRPC'
        : _.capitalize(contentType);
}

export function getDefaultMimeType(contentType: ViewableContentType): string {
    // Uses the *first* mime type listed for this key in our map
    return _.findKey(mimeTypeToContentTypeMap, (c) => c === contentType)!;
}

function isAlphaNumOrEquals(byte: number) {
    return (byte >= 65 && byte <= 90) || // A-Z
        (byte >= 97 && byte <= 122) ||   // a-z
        (byte >= 48 && byte <= 57) ||    // 0-9
        byte === 61;                     // =
}

function isValidStandardBase64Byte(byte: number) {
    // + / (standard)
    return byte === 43 ||
        byte === 47 ||
        isAlphaNumOrEquals(byte);
}

function isValidURLSafeBase64Byte(byte: number) {
    // - _ (URL-safe version)
    return byte === 45 ||
        byte === 95 ||
        isAlphaNumOrEquals(byte);
}

export interface ContentViewOptions {
    preferredContentType: ViewableContentType;
    availableContentTypes: ViewableContentType[];
}

export function getCompatibleTypes(
    contentType: ViewableContentType,
    rawContentType: string | undefined,
    messageBody: MessageBody | Buffer | undefined,
    headers?: Headers,
): ContentViewOptions {
    let preferredType = contentType;
    let availableTypes = new Set([contentType]);

    let body: Buffer | undefined;
    if (messageBody && Buffer.isBuffer(messageBody)) {
        body = messageBody;
    } else if (messageBody) {
        body = messageBody.decodedData;
    }

    // For common mistypings, we override the default type if we're confident
    const isCommonDefaultType = contentType === 'raw' || contentType === 'text' || contentType === 'html';
    const firstRealChar = getFirstRealChar(body);

    // Format non-JSON-records as JSON-records, if it looks like it might be
    if (!availableTypes.has('json-records') && isProbablyJsonRecords(body)) {
        availableTypes.add('json-records');
        preferredType = 'json-records';

        if (isCommonDefaultType) {
            preferredType = 'json-records';
        }
    }

    if (!availableTypes.has('json-records') && isProbablyJson(body)) {
        // Allow optionally formatting non-JSON as JSON, if it's anything remotely close
        availableTypes.add('json');

        if (isCommonDefaultType) {
            preferredType = 'json';
        }
    }

    if (
        body &&
        !availableTypes.has('protobuf') &&
        !availableTypes.has('grpc-proto') &&
        isProbablyProtobuf(body) &&
        // If it's probably unmarked protobuf, and it's a manageable size, try
        // parsing it just to check:
        (body.length < 100_000 && isValidProtobuf(body))
    ) {
        availableTypes.add('protobuf');

        if (isCommonDefaultType && body.length < 100_000) { // If we've checked fully
            preferredType = 'protobuf';
        }
    }

    if (
        body &&
        !availableTypes.has('grpc-proto') &&
        isProbablyGrpcProto(body, headers ?? {}) &&
        // If it's probably unmarked gRPC, and it's a manageable size, try
        // parsing it just to check:
        (body.length < 100_000 && isValidGrpcProto(body, headers ?? {}))
    ) {
        availableTypes.add('grpc-proto');

        if (isCommonDefaultType && body.length < 100_000) { // If we've checked fully
            preferredType = 'grpc-proto';
        }
    }

    // SVGs can always be shown as XML
    if (rawContentType && rawContentType.startsWith('image/svg')) {
        availableTypes.add('xml');
    }

    // Allow optionally formatting non-XML as XML, if it looks like it might be but
    // isn't otherwise recognized as such:
    if (firstRealChar === '<') {
        if (!availableTypes.has('xml')) {
            availableTypes.add('xml');

            if (contentType !== 'html' && isCommonDefaultType) {
                preferredType = 'xml';
            }

            // Sniffed XML could also be HTML, as long as it's not an SVG:
            if (contentType !== 'image') {
                availableTypes.add('html');
            }
        }
    } else {
        // If it doesn't start with < then it's no normal HTML, no matter what it says.
        // Treat as text by default instead to avoid formatting issues:
        if (preferredType === 'html') {
            preferredType = 'text';
        }
    }

    if (
        body &&
        !availableTypes.has('base64') &&
        body.length >= 8 &&
        // body.length % 4 === 0 && // Multiple of 4 bytes (no - final padding may be omitted)
        body.length < 100_000 && // < 100 KB of content
        (body.every(isValidStandardBase64Byte) || body.every(isValidURLSafeBase64Byte))
    ) {
        availableTypes.add('base64');
    }

    // Lastly, anything can be shown raw or as text, if you like:
    availableTypes.add('text');
    availableTypes.add('raw');

    return {
        preferredContentType: preferredType,
        availableContentTypes: Array.from(availableTypes)
    };
}

function getFirstRealChar(buffer: Buffer | undefined): string | null {
    if (!buffer || buffer.length === 0) return null;

    // Detect BOM, skip it if present
    let startOffset = 0;
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        startOffset = 3;
    }

    // We ignore common whitespace - no need to worry about unicode edge cases etc:
    const firstNonWhitespaceByte = buffer
        .subarray(startOffset, startOffset + 1024)
        .find(byte =>
            byte !== 0x20 && // Space
            byte !== 0x09 && // Tab
            byte !== 0x0A && // LF
            byte !== 0x0D    // CR
        );

    return firstNonWhitespaceByte !== undefined
        ? String.fromCharCode(firstNonWhitespaceByte)
        : null;
}