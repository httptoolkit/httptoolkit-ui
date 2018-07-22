import * as React from "react";

import * as monacoEditor from "monaco-editor";
import MonacoEditor from 'react-monaco-editor';

import { styled } from '../styles';

const minify = (text: string) => JSON.stringify(JSON.parse(text));
const prettify = (text: string) => JSON.stringify(JSON.parse(text), null, 2);

interface JsonEditorProps {
    children: string;
    onChange: (content: string) => void;
    options?: monacoEditor.editor.IEditorConstructionOptions;
}

interface JsonEditorState {
    content: string;
    error: boolean;
}

export default class extends React.PureComponent<JsonEditorProps, JsonEditorState> {
    monaco: typeof monacoEditor;
    editor: monacoEditor.editor.IStandaloneCodeEditor;

    constructor(props: JsonEditorProps) {
        super(props);

        this.state = this.getDerivedStateFromProps(props, {
            error: false,
            content: ''
        }) as JsonEditorState;
    }

    componentWillReceiveProps(nextProps: JsonEditorProps) {
        this.setState(this.getDerivedStateFromProps(nextProps, this.state));
    }

    getDerivedStateFromProps(nextProps: JsonEditorProps, prevState: JsonEditorState) : JsonEditorState | {} {
        try {
            const minifiedCurrentContent = prevState.content && minify(prevState.content);

            if (minifiedCurrentContent !== nextProps.children) {
                return {
                    error: false,
                    content: prettify(nextProps.children)
                };
            } else {
                return {};
            }
        } catch (e) {
            return {
                error: true,
                content: nextProps.children
            };
        }
    }

    saveAndMaybeAnnounceChange = (newContent: string) => {
        this.setState({ content: newContent });

        try {
            newContent = minify(newContent);
        } catch (e) {
            this.setState({
                error: true
            });
            return;
        }

        if (newContent !== this.props.children) {
            this.props.onChange(newContent);
        }
    }

    shouldComponentUpdate(newProps: JsonEditorProps, newState: JsonEditorState) {
        if (newState.error !== this.state.error) return true;
        if (newState.content !== this.state.content) return true;

        return false;
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
            minimap: { enabled: false }
        }, this.props.options);

        return <MonacoEditor
            language="json"
            value={this.state.content}
            options={options}
            onChange={this.saveAndMaybeAnnounceChange}
            editorWillMount={this.onEditorWillMount}
            editorDidMount={this.onEditorDidMount}
        />;
    }
}