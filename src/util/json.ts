const JSON_START_REGEX = /^\s*[\[\{tfn"\d-]/; // Optional whitespace, then start array/object/true/false/null/string/number

const JSON_TEXT_SEQ_START_REGEX = /^\u001E\s*[\[\{]/; // Record separate, optional whitespace, then array/object

const SIGNALR_HUB_START_REGEX = /^\s*\{/; // Optional whitespace, then start object
const SIGNALR_HUB_END_REGEX = /\}\s*\u001E$/; // End object, optional whitespace, then record separator

const JSON_LINES_END_REGEX = /[\]\}](\r?\n)+$/; // Array/object end, then optional newline(s)
const JSON_LINES_INNER_REGEX = /[\]\}](\r?\n)+[\{\[]/; // Object/array end, then newline(s), then start object/array
const JSON_LINES_SCAN_LIMIT = 16 * 1024;

export const isProbablyJson = (text: Buffer | undefined) => {
    if (!text || text.length < 2) return false;

    const startChunk = text.subarray(0, 6).toString('utf8');
    return JSON_START_REGEX.test(startChunk);
}

export const isProbablyJsonRecords = (text: Buffer | undefined) => {
    if (!text || text.length < 3) return false;

    // This has some false negatives: e.g. standalone JSON primitive values, or unusual
    // extra whitespace in certain places, but I think it should provide pretty good coverage
    // the rest of the time.

    const startChunk = text.subarray(0, 6).toString('utf8');
    const endChunk = text.subarray(-6).toString('utf8');

    if (JSON_TEXT_SEQ_START_REGEX.test(startChunk)) {
        // JSON text sequence: https://www.rfc-editor.org/rfc/rfc7464.html
        return true;
    }

    if (SIGNALR_HUB_START_REGEX.test(startChunk) && SIGNALR_HUB_END_REGEX.test(endChunk)) {
        // SignalR hub protocol:
        // https://github.com/dotnet/aspnetcore/blob/main/src/SignalR/docs/specs/HubProtocol.md#json-encoding
        return true;
    }

    if (
        JSON_START_REGEX.test(startChunk) &&
        // Technically for JSON Lines the end newline is optional, but strongly recommended & common AFAICT
        JSON_LINES_END_REGEX.test(endChunk) &&
        // If the end looks like JSON lines/NDJSON, so scan a bigger chunk to check:
        JSON_LINES_INNER_REGEX.test(text.subarray(0, JSON_LINES_SCAN_LIMIT).toString('utf8'))
    ) {
        // JSON Lines or NDJSON: https://jsonlines.org/
        return true;
    }

    return false;
}

export const RECORD_SEPARATOR_CHARS = [
    '\u001E', // ASCII Record Separator (used by SignalR and others)
    '\n',
    '\r'
];
