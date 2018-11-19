import * as _ from 'lodash';
import * as React from 'react';

import * as monacoEditor from 'monaco-editor';
import MonacoEditor, { MonacoEditorProps } from 'react-monaco-editor';

export interface EditorProps extends MonacoEditorProps {
    onLineCount?: (lineCount: number) => void;
}

export class BaseEditor extends React.Component<EditorProps> {
    monaco: typeof monacoEditor;
    editor: monacoEditor.editor.IStandaloneCodeEditor;

    constructor(props: EditorProps) {
        super(props);
    }

    onEditorWillMount = (monaco: typeof monacoEditor) => {
        this.monaco = monaco;
    }

    onEditorDidMount = (editor: monacoEditor.editor.IStandaloneCodeEditor) => {
        this.editor = editor;

        let lineCount = (editor as any).viewModel.getLineCount();

        if (this.props.onLineCount) {
            this.props.onLineCount(lineCount);
        }
    }

    componentDidUpdate() {
        if (this.editor) {
            let lineCount = (this.editor as any).viewModel.getLineCount();

            if (this.props.onLineCount) {
                this.props.onLineCount(lineCount);
            }
        }
    }

    render() {
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
            editorWillMount={this.onEditorWillMount}
            editorDidMount={this.onEditorDidMount}
        />
    }
}