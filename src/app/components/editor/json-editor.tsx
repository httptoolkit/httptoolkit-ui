import * as React from "react";

import * as monacoEditor from "monaco-editor";
import MonacoEditor from 'react-monaco-editor';
import { BaseEditor, EditorProps } from "./base-editor";

const minify = (text: string) => JSON.stringify(JSON.parse(text));
const prettify = (text: string) => JSON.stringify(JSON.parse(text), null, 2);

interface JsonEditorState {
    content: string;
    error: boolean;
}

export class JsonEditor extends BaseEditor<EditorProps, JsonEditorState> {

    constructor(props: EditorProps) {
        super(props);

        this.state = JsonEditor.getDerivedStateFromProps(props, {
            error: false,
            content: ''
        }) as JsonEditorState;
    }

    static getDerivedStateFromProps(nextProps: EditorProps, prevState: JsonEditorState) : JsonEditorState | {} {
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
            this.props.onChange && this.props.onChange(newContent);
        }
    }

    shouldComponentUpdate(newProps: EditorProps, newState: JsonEditorState) {
        if (newState.error !== this.state.error) return true;
        if (newState.content !== this.state.content) return true;

        return false;
    }

    render() {
        return <MonacoEditor
            language="json"
            value={this.state.content}
            options={this.props.options}
            onChange={this.saveAndMaybeAnnounceChange}
            editorWillMount={this.onEditorWillMount}
            editorDidMount={this.onEditorDidMount}
        />;
    }
}