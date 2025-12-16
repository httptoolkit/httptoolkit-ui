import {
    js as beautifyJs,
    html as beautifyHtml,
    css as beautifyCss
} from 'js-beautify/js/lib/beautifier';
import * as beautifyXml from 'xml-beautifier';

import { Headers } from '../types';
import { bufferToHex, bufferToString, getReadableSize } from '../util/buffer';
import { parseRawProtobuf, extractProtobufFromGrpc } from '../util/protobuf';
import { formatJson } from '../util/json';

const truncationMarker = (size: string) => `\n[-- Truncated to ${size} --]`;
const FIVE_MB = 1024 * 1024 * 5;

export type WorkerFormatterKey = keyof typeof WorkerFormatters;

export function formatBuffer(buffer: ArrayBuffer, format: WorkerFormatterKey, headers?: Headers): string {
    return WorkerFormatters[format](Buffer.from(buffer), headers);
}

const prettyProtobufView = (data: any) => JSON.stringify(data, (_key, value) => {
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
            content = content.subarray(0, FIVE_MB)
        }

        const formattedContent = bufferToHex(content);

        if (needsTruncation) {
            return formattedContent + truncationMarker("5MB");
        } else {
            return formattedContent;
        }
    },
    base64: (content: Buffer) => {
        const b64 = content.toString('ascii');
        return Buffer.from(b64, 'base64').toString('utf8');
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

        // Do simplify parse + stringify where possible for speed - it's up to 1000x faster.
        // We fall back to the relaxed formatJson() where that fails, which is slower but
        // always comes up with something reasonable - unless it's very large, in which
        // case we give up rather than hanging the UI:
        try {
            return JSON.stringify(JSON.parse(asString), null, 2);
        } catch (e) {
            if (content.byteLength <= 5_000_000) {
                return formatJson(asString, { formatRecords: false });
            } else {
                // Large non-parseable content - we fall back to the raw string
                return asString;
            }
        }
    },
    'json-records': (content: Buffer) => {
        const asString = content.toString('utf8');
        return formatJson(asString, { formatRecords: true });
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
        const data = parseRawProtobuf(content, { prefix: '' });
        return prettyProtobufView(data);
    },
    'grpc-proto': (content: Buffer, headers?: Headers) => {
        const protobufMessages = extractProtobufFromGrpc(content, headers ?? {});

        let data = protobufMessages.map((msg) => parseRawProtobuf(msg, { prefix: '' }));
        if (data.length === 1) data = data[0];

        return prettyProtobufView(data);
    }
} as const;