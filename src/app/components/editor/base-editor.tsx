import * as React from 'react';

import * as monacoEditor from 'monaco-editor';
import MonacoEditor from 'react-monaco-editor';

export interface EditorProps {
    children: string;
    options?: monacoEditor.editor.IEditorConstructionOptions;

    onChange?: (content: string) => void;
    onLineCount?: (lineCount: number) => void;
}

export abstract class BaseEditor<
    P extends EditorProps = EditorProps,
    S = {}
> extends React.Component<P, S> {
    monaco: typeof monacoEditor;
    editor: monacoEditor.editor.IStandaloneCodeEditor;

    constructor(props: P) {
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
}