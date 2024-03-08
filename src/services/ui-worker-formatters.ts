import {
    js as beautifyJs,
    html as beautifyHtml,
    css as beautifyCss
} from 'js-beautify/js/lib/beautifier';
import * as beautifyXml from 'xml-beautifier';

import { bufferToHex, bufferToString, getReadableSize } from '../util/buffer';
import { parseRawProtobuf } from '../util/protobuf';

const truncationMarker = (size: string) => `\n[-- Truncated to ${size} --]`;
const FIVE_MB = 1024 * 1024 * 5;

export type WorkerFormatterKey = keyof typeof WorkerFormatters;

export function formatBuffer(buffer: ArrayBuffer, format: WorkerFormatterKey): string {
    return WorkerFormatters[format](Buffer.from(buffer));
}

// A subset of all possible formatters (those allowed by body-formatting), which require
// non-trivial processing, and therefore need to be processed async.
const WorkerFormatters = {
    // Poor man's hex editor:
    raw: (content: Buffer) => {
        // Truncate the content if necessary. Nobody should manually dig
        // through more than 5MB of content, and the full content is
        // available by downloading the whole body.
        const needsTruncation = content.length > FIVE_MB;
        if (needsTruncation) {
            content = content.slice(0, FIVE_MB)
        }

        const formattedContent = bufferToHex(content);

        if (needsTruncation) {
            return formattedContent + truncationMarker("5MB");
        } else {
            return formattedContent;
        }
    },
    base64: (content: Buffer) => {
        return Buffer.from(content.toString('utf8'), 'base64').toString('utf8');
    },
    markdown: (content: Buffer) => {
        return content.toString('utf8');
    },
    yaml: (content: Buffer) => {
        return content.toString('utf8');
    },
    html: (content: Buffer) => {
        return beautifyHtml(content.toString('utf8'), {
            indent_size: 2
        });
    },
    xml: (content: Buffer) => {
        return beautifyXml(content.toString('utf8'), '  ');
    },
    json: (content: Buffer) => {
        const asString = content.toString('utf8');
        try {
            return JSON.stringify(JSON.parse(asString), null, 2);
        } catch (e) {
            return asString;
        }
    },
    javascript: (content: Buffer) => {
        return beautifyJs(content.toString('utf8'), {
            indent_size: 2
        });
    },
    css: (content: Buffer) => {
        return beautifyCss(content.toString('utf8'), {
            indent_size: 2
        });
    },
    protobuf: (content: Buffer) => {
        const data = parseRawProtobuf(content, {
            prefix: ''
        });

        return JSON.stringify(data, (_key, value) => {
            // Buffers have toJSON defined, so arrive here in JSONified form:
            if (value.type === 'Buffer' && Array.isArray(value.data)) {
                const buffer = Buffer.from(value.data);

                return {
                    "Type": `Buffer (${getReadableSize(buffer)})`,
                    "As string": bufferToString(buffer, 'detect-encoding'),
                    "As hex": bufferToHex(buffer)
                }
            } else {
                return value;
            }
        }, 2);
    }
} as const;