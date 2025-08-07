import type * as MonacoTypes from 'monaco-editor';

import { XMLValidator } from 'fast-xml-parser';
import * as jsonCParser from 'jsonc-parser';

import { camelToSentenceCase } from '../../util/text';
import { RECORD_SEPARATOR_CHARS } from '../../util/json';

export interface ContentValidator {
    (text: string, model: MonacoTypes.editor.ITextModel): ValidationMarker[];
}

// A minimal more generic version of Monaco's MonacoTypes.editor.IMarkerData type:
export interface ValidationMarker {
    severity: MarkerSeverity;
    message: string;
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
}

enum MarkerSeverity {
    Hint = 1,
    Info = 2,
    Warning = 4,
    Error = 8
}

export function validateXml(text: string): ValidationMarker[] {
    const markers: ValidationMarker[] = [];

    if (!text.trim()) return markers;

    const validationResult = XMLValidator.validate(text, {
        allowBooleanAttributes: true,
    })

    if (validationResult !== true) {
        markers.push({
            severity: MarkerSeverity.Error,
            startLineNumber: validationResult.err.line,
            startColumn: validationResult.err.col,
            endLineNumber: validationResult.err.line,
            endColumn: Infinity,
            message: validationResult.err.msg,
        })
    }

    return markers;
}

export function validateJsonRecords(text: string, model: MonacoTypes.editor.ITextModel): ValidationMarker[] {
    const markers: ValidationMarker[] = [];
    if (!text.trim()) return markers;

    let offset = 0;
    let remainingText = text.trimEnd();
    while (remainingText) {
        if (RECORD_SEPARATOR_CHARS.includes(remainingText[0])) {
            remainingText = remainingText.slice(1);
            offset++;
            continue;
        }

        const errors: jsonCParser.ParseError[] = [];
        const result = jsonCParser.parseTree(remainingText, errors, {
            allowTrailingComma: false,
            disallowComments: true
        });

        const parsedContentLength = result
            ? result.offset + result.length
            : Math.max(...errors.map((err) => err.offset + err.length));

        // We show the first error for each record, except any errors after the end of
        // a completely parsed value (i.e. due to hitting the subsequent record instead
        // of an expected EOF). We'll handle that in the next iteration one way or another.
        if (errors.length) {
            const firstError = errors[0];
            if (firstError && firstError.offset < parsedContentLength) {
                const position = model.getPositionAt(offset + firstError.offset);
                markers.push({
                    severity: MarkerSeverity.Error,
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endColumn: position.column + firstError.length,
                    message: camelToSentenceCase(jsonCParser.printParseErrorCode(firstError.error))
                });
            }
        }

        if (parsedContentLength === 0) {
            // Should never happen, but this should at least give us some debug info if it ever does:
            console.log(`Parsing ${remainingText} (${remainingText.length}) parsedContentLength was 0 with ${
                result
            } result and ${JSON.stringify(errors)} errors`);
            throw new Error(`JSON record parsed content length was 0`);
        }

        remainingText = remainingText.slice(parsedContentLength);
        offset += parsedContentLength;
    }

    return markers;
}
