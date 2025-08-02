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
            let offset = 0;
            for (let i = 0; i < splits.length; i++) {
                const part = splits[i];
                if (part) {
                    let errors: json_parser.ParseError[] = []
                    json_parser.parse(part, errors, { allowTrailingComma: false, disallowComments: true });
                    console.log(`Validating JSON record part [${i}] `, part, `error ${JSON.stringify(errors)}`);
                    if (errors) {
                        errors.forEach((err) => {
                            markers.push({
                                severity: monaco.MarkerSeverity.Error,
                                startLineNumber: 0,
                                startColumn: offset, // +1 for the separator
                                endLineNumber: 0,
                                endColumn: offset + err.length,
                                message: err.error.toString(),
                            })
                        });
                    }
                }

                offset += part.length + 1; // +1 for the separator
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
