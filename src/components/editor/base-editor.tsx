import * as _ from 'lodash';
import * as React from 'react';
import { observer, disposeOnUnmount } from 'mobx-react';
import { observable, action, autorun } from 'mobx';
import { SchemaObject } from 'openapi-directory';

import * as monacoTypes from 'monaco-editor';
import _MonacoEditor, { MonacoEditorProps } from 'react-monaco-editor';

import { reportError } from '../../errors';
import { delay } from '../../util';
import { WritableKeys } from '../../types';

let MonacoEditor: typeof _MonacoEditor | undefined;
// Defer loading react-monaco-editor ever so slightly. This has two benefits:
// * don't delay first app start waiting for this massive chunk to load
// * better caching (app/monaco-editor bundles can update independently)
let rmeModulePromise = delay(100).then(() => loadMonacoEditor());

async function loadMonacoEditor(retries = 5): Promise<void> {
    try {
        const rmeModule = await import(/* webpackChunkName: "react-monaco-editor" */ 'react-monaco-editor');
        MonacoEditor = rmeModule.default;
    } catch (err) {
        if (retries <= 0) {
            console.warn('Repeatedly failed to load monaco editor, giving up');
            throw err;
        }

        return loadMonacoEditor(retries - 1);
    }
}

// Work around for https://github.com/Microsoft/monaco-editor/issues/311
// Forcibly override various methods to ensure we return line decorations
// for validation errors etc even if the editor is readonly.
function enableMarkers(model: monacoTypes.editor.ITextModel | null) {
    if (!model) return;

    const methodsToFix:  Array<[WritableKeys<typeof model>, number]> = [
        ['getLineDecorations', 2],
        ['getLinesDecorations', 3],
        ['getDecorationsInRange', 2],
        ['getOverviewRulerDecorations', 1],
        ['getAllDecorations', 1],
    ];

    methodsToFix.forEach(([functionName, maxArgs]) => {
        const originalMethod = model[functionName];
        model[functionName] = function() {
            return originalMethod.apply(this, Array.from(arguments).slice(0, maxArgs));
        };
    });
}

export interface EditorProps extends MonacoEditorProps {
    onLineCount?: (lineCount: number) => void;
    schema?: SchemaObject;
}

// Extracted unnamed type from Monaco
interface SchemaMapping {
    readonly uri: string;
    readonly fileMatch?: string[];
    readonly schema?: any;
}

@observer
export class BaseEditor extends React.Component<EditorProps> {

    // Both provided async, once the editor has initialized
    editor: monacoTypes.editor.IStandaloneCodeEditor | undefined;
    monaco: (typeof monacoTypes) | undefined;

    @observable
    monacoEditorLoaded = !!MonacoEditor;

    @observable
    modelUri: string | null = null;

    registeredSchemaUri: string | null = null;

    constructor(props: EditorProps) {
        super(props);

        if (!this.monacoEditorLoaded) {
            rmeModulePromise
                // Did it fail before? Retry it now, just in case
                .catch(() => {
                    rmeModulePromise = loadMonacoEditor(0);
                    return rmeModulePromise;
                })
                .then(action(() => this.monacoEditorLoaded = true));
        }
    }

    private announceLineCount(editor: monacoTypes.editor.IStandaloneCodeEditor) {
        // This is also available as model.getLineCount(), but the model
        // itself doesn't take line wrapping into account.
        let lineCount = (editor as any)._modelData.viewModel.getLineCount();

        if (this.props.onLineCount) {
            this.props.onLineCount(lineCount);
        }
    }

    @action.bound
    onEditorDidMount(editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: typeof monacoTypes) {
        this.editor = editor;
        this.monaco = monaco;
        this.announceLineCount(editor);

        const model = editor.getModel();
        enableMarkers(model);

        this.modelUri = model && model.uri.toString();
        this.editor.onDidChangeModel(action((e: monacoTypes.editor.IModelChangedEvent) => {
            enableMarkers(editor.getModel());
            this.modelUri = e.newModelUrl && e.newModelUrl.toString()
        }));
    }

    componentDidMount() {
        // We don't run _after_ unmount, so we'll leave behind schemas on unmount, which isn't great...
        disposeOnUnmount(this, autorun(() => {
            if (!this.editor || !this.monaco) return;

            const existingOptions = this.monaco.languages.json.jsonDefaults.diagnosticsOptions;
            let newSchemaMappings: SchemaMapping[] = existingOptions.schemas || [];

            if (this.modelUri) {
                const newSchema = this.props.schema;

                const existingMapping = _.find(existingOptions.schemas || [],
                    (sm: SchemaMapping) => sm.uri === this.modelUri
                ) as SchemaMapping | undefined;

                if (newSchema && (!existingMapping || existingMapping.schema !== newSchema)) {
                    // If we have a replacement/new schema for this file, replace/add it.
                    newSchemaMappings = newSchemaMappings
                        .filter((sm) => sm !== existingMapping)
                        .concat({ uri: this.modelUri, fileMatch: [this.modelUri], schema: newSchema });
                } else if (!newSchema) {
                    // If we have no schema for this file, drop the schema
                    newSchemaMappings = newSchemaMappings
                        .filter((sm) => sm !== existingMapping);
                }
            }

            if (this.registeredSchemaUri && this.modelUri != this.registeredSchemaUri) {
                // If we registered a previous schema for a different model, clear it up.
                newSchemaMappings = newSchemaMappings
                    .filter((sm) => sm.uri !== this.registeredSchemaUri);
            }

            const options = Object.assign({}, existingOptions, {
                validate: true,
                schemas: newSchemaMappings
            })

            this.monaco.languages.json.jsonDefaults.setDiagnosticsOptions(options);
            this.registeredSchemaUri = this.modelUri;
        }));
    }

    componentWillUnmount() {
        if (this.editor && this.monaco && this.registeredSchemaUri) {
            // When we unmount, clear our registered schema, if we have one.
            const existingOptions = this.monaco.languages.json.jsonDefaults.diagnosticsOptions;

            const newSchemaMappings = (existingOptions.schemas || [])
                .filter((sm) => sm.uri !== this.registeredSchemaUri);

            this.monaco.languages.json.jsonDefaults.setDiagnosticsOptions(
                Object.assign({}, existingOptions, {
                    schemas: newSchemaMappings
                })
            );
            this.registeredSchemaUri = null;
        }
    }

    componentDidUpdate() {
        if (this.editor) {
            this.announceLineCount(this.editor);
        }
    }

    render() {
        if (!this.monacoEditorLoaded || !MonacoEditor) {
            reportError('Monaco editor failed to load');
            return null;
        }

        const options = _.defaults(this.props.options, {
            automaticLayout: true,
            showFoldingControls: 'always',

            quickSuggestions: false,
            parameterHints: false,
            codeLens: false,
            minimap: { enabled: false },
            contextmenu: false,
            scrollBeyondLastLine: false,

            // TODO: Would like to set a fontFace here, but due to
            // https://github.com/Microsoft/monaco-editor/issues/392
            // it breaks wordwrap

            fontSize: 16,
            wordWrap: 'on'
        });

        return <MonacoEditor
            {...this.props}
            options={options}
            editorDidMount={this.onEditorDidMount}
        />
    }
}