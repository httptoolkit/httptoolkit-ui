import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';
import { observable, action } from 'mobx';

import * as monacoEditor from 'monaco-editor';
import _MonacoEditor, { MonacoEditorProps } from 'react-monaco-editor';

import { reportError } from '../../errors';
import { delay } from '../../util';

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

export interface EditorProps extends MonacoEditorProps {
    onLineCount?: (lineCount: number) => void;
}

@observer
export class BaseEditor extends React.Component<EditorProps> {

    editor: monacoEditor.editor.IStandaloneCodeEditor | undefined;

    @observable
    monacoEditorLoaded = !!MonacoEditor;

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

    private announceLineCount(editor: monacoEditor.editor.IStandaloneCodeEditor) {
        let lineCount = (editor as any)._modelData.viewModel.getLineCount();

        if (this.props.onLineCount) {
            this.props.onLineCount(lineCount);
        }
    }

    onEditorDidMount = (editor: monacoEditor.editor.IStandaloneCodeEditor) => {
        this.editor = editor;
        this.announceLineCount(editor);
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