import * as React from 'react';

import MonacoEditor from 'react-monaco-editor';

import { BaseEditor, EditorProps } from './base-editor';

export class TextEditor extends BaseEditor {

    constructor(props: EditorProps) {
        super(props);
    }

    render() {
        return <MonacoEditor
            language='plaintext'
            value={this.props.children}
            options={this.props.options}
            onChange={this.props.onChange}
            editorWillMount={this.onEditorWillMount}
            editorDidMount={this.onEditorDidMount}
        />;
    }
}