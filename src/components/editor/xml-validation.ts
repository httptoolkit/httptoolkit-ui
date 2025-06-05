import type * as MonacoTypes from 'monaco-editor'
import { XMLValidator } from 'fast-xml-parser'

export function setupXMLValidation(monaco: typeof MonacoTypes) {
    const xmlModels = new Set<MonacoTypes.editor.ITextModel>()

    monaco.editor.onWillDisposeModel(model => {
        xmlModels.delete(model)
    })

    monaco.editor.onDidChangeModelLanguage(event => {
        const model = event.model
        if (model.getModeId() === 'xml' && !xmlModels.has(model)) {
            xmlModels.add(model)
            model.onDidChangeContent(() => {
                const markers: MonacoTypes.editor.IMarkerData[] = []
                const text = model.getValue()

                if (text.trim()) {
                    const validationResult = XMLValidator.validate(text, {
                        allowBooleanAttributes: true,
                    })

                    if (validationResult !== true) {
                        markers.push({
                            severity: monaco.MarkerSeverity.Error,
                            startLineNumber: validationResult.err.line,
                            startColumn: validationResult.err.col,
                            endLineNumber: validationResult.err.line,
                            endColumn: validationResult.err.col + 10, // the 10 is totally arbitrary here
                            message: validationResult.err.msg,
                        })
                    }
                }

                monaco.editor.setModelMarkers(model, 'xml-validation', markers)
            })
        }
    })
}
