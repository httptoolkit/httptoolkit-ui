import type * as MonacoTypes from 'monaco-editor'
import * as json_parser from 'jsonc-parser'

export function setupJsonRecordsValidation(monaco: typeof MonacoTypes) {
    const markerId = 'json-records-validation'

    function validate(model: MonacoTypes.editor.ITextModel) {
        const markers: MonacoTypes.editor.IMarkerData[] = []
        const text = model.getValue();

        if (text) {
            const separator = text[text.length - 1];
            const splits = text.split(separator);

            for (let i = 0; i < splits.length; i++) {
                const part = splits[i];
                if (part) {
                    let errors: ParserError[] = [];
                    parseJson(part, errors, { allowTrailingComma: false, disallowComments: true });
                    if (errors.length) {
                        const firstError = errors[0];
                        markers.push({
                            severity: monaco.MarkerSeverity.Error,
                            startLineNumber: i + 1,
                            startColumn: firstError.startCharacter + 1,
                            endLineNumber: i + 1,
                            endColumn: firstError.startCharacter + firstError.length + 1,
                            message: json_parser.printParseErrorCode(firstError.error)
                        });
                    }
                }
            }
        }

        monaco.editor.setModelMarkers(model, markerId, markers)
    }

    const contentChangeListeners = new Map<MonacoTypes.editor.ITextModel, MonacoTypes.IDisposable>()
    function manageContentChangeListener(model: MonacoTypes.editor.ITextModel) {
        const isJsonRecords = model.getModeId() === 'json-records'
        const listener = contentChangeListeners.get(model)

        if (isJsonRecords && !listener) {
            contentChangeListeners.set(
                model,
                model.onDidChangeContent(() => validate(model))
            )
            validate(model)
        } else if (!isJsonRecords && listener) {
            listener.dispose()
            contentChangeListeners.delete(model)
            monaco.editor.setModelMarkers(model, markerId, [])
        }
    }

    monaco.editor.onWillDisposeModel(model => {
        contentChangeListeners.delete(model)
    })
    monaco.editor.onDidChangeModelLanguage(({ model }) => {
        manageContentChangeListener(model)
    })
    monaco.editor.onDidCreateModel(model => {
        manageContentChangeListener(model)
    })
}


interface ParserError extends json_parser.ParseError {
	startLine: number;
	startCharacter: number;
}

function parseJson(text: string, errors: ParserError[] = [], options: json_parser.ParseOptions = {}): any {
	let currentProperty: string | null = null;
	let currentParent: any = [];
	const previousParents: any[] = [];

	function onValue(value: any) {
		if (Array.isArray(currentParent)) {
			(<any[]>currentParent).push(value);
		} else if (currentProperty !== null) {
			currentParent[currentProperty] = value;
		}
	}

	const visitor: json_parser.JSONVisitor = {
		onObjectBegin: () => {
			const object = {};
			onValue(object);
			previousParents.push(currentParent);
			currentParent = object;
			currentProperty = null;
		},
		onObjectProperty: (name: string) => {
			currentProperty = name;
		},
		onObjectEnd: () => {
			currentParent = previousParents.pop();
		},
		onArrayBegin: () => {
			const array: any[] = [];
			onValue(array);
			previousParents.push(currentParent);
			currentParent = array;
			currentProperty = null;
		},
		onArrayEnd: () => {
			currentParent = previousParents.pop();
		},
		onLiteralValue: onValue,
		onError: (error: json_parser.ParseErrorCode, offset: number, length: number, startLine: number, startCharacter: number) => {
			errors.push({ error, offset, length, startLine, startCharacter });
		}
	};
	json_parser.visit(text, visitor, options);
	return currentParent[0];
}
