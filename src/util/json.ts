import {
    createScanner as createJsonScanner,
    SyntaxKind as JsonSyntaxKind
} from 'jsonc-parser';

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
        // https://github.com/dotnet/aspnetcore/blob/v9.0.8/src/SignalR/docs/specs/HubProtocol.md
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

// Accumulates output in chunks, since reading the end of a large concatenated string forces
// V8 to flatten (copy) the whole thing, making formatting quadratic in the output size.
class OutputBuffer {
    private chunks: string[] = [];

    append(text: string) {
        if (text) this.chunks.push(text);
    }

    isEmpty() {
        return this.chunks.length === 0;
    }

    charFromEnd(offset: number): string | undefined {
        for (let i = this.chunks.length - 1; i >= 0; i--) {
            const chunk = this.chunks[i];
            if (offset < chunk.length) return chunk[chunk.length - 1 - offset];
            offset -= chunk.length;
        }
        return undefined;
    }

    endsWith(char: string) {
        return this.charFromEnd(0) === char;
    }

    // Returns whether any whitespace was removed
    trimEnd(): boolean {
        let trimmed = false;
        while (this.chunks.length) {
            const last = this.chunks[this.chunks.length - 1];
            const trimmedLast = last.trimEnd();
            if (trimmedLast.length === last.length) break;

            trimmed = true;
            if (trimmedLast) {
                this.chunks[this.chunks.length - 1] = trimmedLast;
                break;
            }
            this.chunks.pop();
        }
        return trimmed;
    }

    toString() {
        return this.chunks.join('');
    }
}

// A *very* forgiving & flexible JSON formatter. This will correctly format even things that
// will fail validation later, such as trailing commas, unquoted keys, comments, etc.
export function formatJson(text: string, options: { formatRecords: boolean } = { formatRecords: false }): string {
    const scanner = createJsonScanner(text);

    const result = new OutputBuffer();
    let indent = 0;
    let token: JsonSyntaxKind;

    const indentString = '  ';
    let needsIndent = false;
    let previousToken: JsonSyntaxKind | null = null;

    let betweenRecords = false;

    while ((token = scanner.scan()) !== JsonSyntaxKind.EOF) {
        const tokenOffset = scanner.getTokenOffset();
        const tokenLength = scanner.getTokenLength();
        const tokenText = text.slice(tokenOffset, tokenOffset + tokenLength);

        if (options.formatRecords && indent === 0) {
            betweenRecords = true;
        }

        // Skip over explicit 'record separator' characters, which can cause parsing problems
        // when parsing JSON records:
        if (betweenRecords && tokenText[0] === '\u001E') {
            scanner.setPosition(tokenOffset + 1);
            continue;
        }

        // Ignore irrelevant whitespace (internally or between records) - we'll handle that ourselves
        if (token === JsonSyntaxKind.Trivia || token === JsonSyntaxKind.LineBreakTrivia) {
            continue;
        }

        if (betweenRecords) {
            // We've finished one record and we have another coming that won't get a newline
            // automatically: add an extra newline to properly separate records if required.
            betweenRecords = false;
            if (!result.isEmpty() && !result.endsWith('\n') && !isValueToken(token)) {
                result.append('\n');
            }
        }

        if (needsIndent) {
            result.append(indentString.repeat(indent));
            needsIndent = false;
        }

        switch (token) {
            case JsonSyntaxKind.OpenBraceToken:
            case JsonSyntaxKind.OpenBracketToken:
                result.append(tokenText);
                indent++;

                const afterOpener = scanAhead(scanner);
                const isClosing = afterOpener === JsonSyntaxKind.CloseBraceToken ||
                                 afterOpener === JsonSyntaxKind.CloseBracketToken;
                if (
                    !isClosing &&
                    afterOpener !== JsonSyntaxKind.EOF &&
                    afterOpener !== JsonSyntaxKind.LineCommentTrivia
                ) {
                    result.append('\n');
                    needsIndent = true;
                }
                break;

            case JsonSyntaxKind.CloseBraceToken:
            case JsonSyntaxKind.CloseBracketToken:
                const wasEmpty = previousToken === JsonSyntaxKind.OpenBraceToken ||
                                previousToken === JsonSyntaxKind.OpenBracketToken;

                let indentUnderflow = indent === 0;
                indent = Math.max(0, indent - 1);

                if (!wasEmpty) {
                    if (!result.endsWith('\n')) {
                        result.append('\n');
                    }
                    result.append(indentString.repeat(indent));
                }

                result.append(tokenText);
                if (indentUnderflow) result.append('\n');

                break;

            case JsonSyntaxKind.CommaToken:
                result.append(tokenText);

                const afterComma = scanAhead(scanner);
                if (
                    afterComma !== JsonSyntaxKind.LineCommentTrivia &&
                    afterComma !== JsonSyntaxKind.BlockCommentTrivia &&
                    afterComma !== JsonSyntaxKind.CloseBraceToken &&
                    afterComma !== JsonSyntaxKind.CloseBracketToken &&
                    afterComma !== JsonSyntaxKind.EOF &&
                    afterComma !== JsonSyntaxKind.CommaToken
                ) {
                    result.append('\n');
                    needsIndent = true;
                }
                break;

            case JsonSyntaxKind.ColonToken:
                result.append(tokenText);
                result.append(' ');
                break;

            case JsonSyntaxKind.LineCommentTrivia:
                const needsNewlineBefore = (
                    previousToken === JsonSyntaxKind.OpenBraceToken ||
                    previousToken === JsonSyntaxKind.OpenBracketToken
                ) && !result.endsWith('\n');

                if (needsNewlineBefore) {
                    result.append('\n');
                    needsIndent = true;
                }

                if (needsIndent) {
                    result.append(indentString.repeat(indent));
                    needsIndent = false;
                    result.append(tokenText);
                } else {
                    if (!result.trimEnd()) result.append(' ');
                    result.append(tokenText);
                }

                const afterComment = scanAhead(scanner);
                if (
                    afterComment !== JsonSyntaxKind.CloseBraceToken &&
                    afterComment !== JsonSyntaxKind.CloseBracketToken &&
                    afterComment !== JsonSyntaxKind.EOF
                ) {
                    result.append('\n');
                    needsIndent = true;
                }
                break;

            case JsonSyntaxKind.BlockCommentTrivia:
                const prevChar = result.charFromEnd(0);
                if (prevChar === '\n' || (prevChar === ' ' && result.charFromEnd(1) === '\n')) {
                    result.append(tokenText);
                } else {
                    result.append(' ');
                    result.append(tokenText);
                }

                const afterBlock = scanAhead(scanner);
                if (
                    afterBlock !== JsonSyntaxKind.CommaToken &&
                    afterBlock !== JsonSyntaxKind.CloseBraceToken &&
                    afterBlock !== JsonSyntaxKind.CloseBracketToken &&
                    afterBlock !== JsonSyntaxKind.EOF
                ) {
                    result.append('\n');
                    needsIndent = true;
                }
                break;

            default:
                const followsValue = isValueToken(previousToken);
                if (followsValue && isValueToken(token) && !result.endsWith('\n')) {
                    // Missing comma detected between sequential values,
                    // so add a newline for readability
                    result.append('\n');
                    result.append(indentString.repeat(indent));
                }

                result.append(tokenText);
                break;
        }

        previousToken = token;
    }

    return result.toString();
}

function isValueToken(token: JsonSyntaxKind | null): boolean {
    return token === JsonSyntaxKind.StringLiteral ||
           token === JsonSyntaxKind.NumericLiteral ||
           token === JsonSyntaxKind.TrueKeyword ||
           token === JsonSyntaxKind.FalseKeyword ||
           token === JsonSyntaxKind.NullKeyword ||
           token === JsonSyntaxKind.CloseBraceToken ||
           token === JsonSyntaxKind.CloseBracketToken;
}

function scanAhead(scanner: any): JsonSyntaxKind {
    const savedPosition = scanner.getPosition();

    let nextToken = scanner.scan();
    while (nextToken === JsonSyntaxKind.Trivia ||
           nextToken === JsonSyntaxKind.LineBreakTrivia) {
        nextToken = scanner.scan();
    }

    scanner.setPosition(savedPosition);
    return nextToken;
}
