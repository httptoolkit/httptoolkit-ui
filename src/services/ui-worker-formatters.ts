import {
    js as beautifyJs,
    html as beautifyHtml,
    css as beautifyCss
} from 'js-beautify/js/lib/beautifier';
import * as beautifyXml from 'xml-beautifier';

import { Headers } from '../types';
import { asBuffer, bufferToHex, bufferToString, getReadableSize } from '../util/buffer';
import { parseRawProtobuf, extractProtobufFromGrpc } from '../util/protobuf';
import { formatJson } from '../util/json';
import { formatEventStreamAsJson } from '../util/event-stream';

const truncationMarker = (size: string) => `\n[-- Truncated to ${size} --]`;
const FIVE_MB = 1024 * 1024 * 5;

export type WorkerFormatterKey = keyof typeof WorkerFormatters;

export function formatBuffer(buffer: ArrayBuffer, format: WorkerFormatterKey, headers?: Headers): string {
    return WorkerFormatters[format](Buffer.from(buffer), headers);
}

const PROTOBUF_INDENT = '  ';

// We serialize manually instead of using JSON.stringify() to handle BigInts and
// buffers better. Does mean this isn't real JSON output, but doesn't matter.
const serializeProtobufValue = (value: unknown, indent: string, output: string[]) => {
    if (typeof value === 'bigint') {
        output.push(value.toString());
        return;
    }

    if (value instanceof Uint8Array) {
        const buffer = asBuffer(value);
        serializeProtobufValue({
            "Type": `Buffer (${getReadableSize(buffer)})`,
            "As string": bufferToString(buffer, 'detect-encoding'),
            "As hex": bufferToHex(buffer)
        }, indent, output);
        return;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            output.push('[]');
            return;
        }

        const innerIndent = indent + PROTOBUF_INDENT;
        output.push('[\n');
        value.forEach((item, i) => {
            if (i > 0) output.push(',\n');
            output.push(innerIndent);
            serializeProtobufValue(item, innerIndent, output);
        });
        output.push('\n', indent, ']');
        return;
    }

    if (typeof value === 'object' && value !== null) {
        const keys = Object.keys(value);
        if (keys.length === 0) {
            output.push('{}');
            return;
        }

        const innerIndent = indent + PROTOBUF_INDENT;
        output.push('{\n');
        keys.forEach((key, i) => {
            if (i > 0) output.push(',\n');
            output.push(innerIndent, JSON.stringify(key), ': ');
            serializeProtobufValue((value as Record<string, unknown>)[key], innerIndent, output);
        });
        output.push('\n', indent, '}');
        return;
    }

    output.push(JSON.stringify(value) ?? 'null');
};

const prettyProtobufView = (data: unknown) => {
    const output: string[] = [];
    serializeProtobufValue(data, '', output);
    return output.join('');
};

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
    'event-stream': (content: Buffer) => {
        return formatEventStreamAsJson(content.toString('utf8'));
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
        const data = parseRawProtobuf(content);
        return prettyProtobufView(data);
    },
    'grpc-proto': (content: Buffer, headers?: Headers) => {
        const protobufMessages = extractProtobufFromGrpc(content, headers ?? {});

        const messages = protobufMessages.map((msg) => parseRawProtobuf(msg));

        return prettyProtobufView(messages.length === 1 ? messages[0] : messages);
    }
} as const;