import * as React from "react";

import * as monacoEditor from "monaco-editor";
import MonacoEditor from 'react-monaco-editor';

import { styled } from '../styles';

interface TextEditorProps {
    children: string;
    onChange: (content: string) => void;
    options?: monacoEditor.editor.IEditorConstructionOptions;
}

export default class extends React.PureComponent<TextEditorProps> {
    monaco: typeof monacoEditor;
    editor: monacoEditor.editor.IStandaloneCodeEditor;

    constructor(props: TextEditorProps) {
        super(props);
    }

    onEditorWillMount = (monaco: typeof monacoEditor) => {
        this.monaco = monaco;
    }

    onEditorDidMount = (editor: monacoEditor.editor.IStandaloneCodeEditor) => {
        this.editor = editor;
    }

    render() {
        const options = Object.assign({
            fontSize: 20,
            minimap: { enabled: false },
            wordWrap: 'on'
        }, this.props.options);

        return <MonacoEditor
            language="plaintext"
            value={this.props.children}
            options={options}
            onChange={this.props.onChange}
            editorWillMount={this.onEditorWillMount}
            editorDidMount={this.onEditorDidMount}
        />;
    }
}