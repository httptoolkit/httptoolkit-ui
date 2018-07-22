import * as React from "react";

import * as monacoEditor from "monaco-editor";

import { styled } from '../styles';
import TabbedContainer from './tabbed-container';
import ContentSize from './content-size';
import JsonEditor from './json-editor';
import TextEditor from './text-editor';

const EditorContainer = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: stretch;
`;

const EditorHeader = styled.h4`
    padding: 10px;
    text-transform: uppercase;

    background-color: ${p => p.theme.popColor};
    color: ${p => p.theme.popBackground};

    width: 99.5%; /* Fixes an odd issue where the header overflows the container, so overflows the gradient that fades it out */
`;

const isValidJson = (content: string) => {
    try {
        JSON.parse(content);
        return true;
    } catch (e) {
        return false;
    }
}

const contentTypeNames = {
    "text/plain": "Text",
    "application/json": "JSON",
    "application/octet-stream": "Hex",
    "application/xml": "XML"
} as { [key: string]: string };

interface EditableBodyProps {
    children: string;
    className?: string;

    contentType: string;
    heading: string;

    options?: monacoEditor.editor.IEditorConstructionOptions;
}

interface EditableBodyState {
    content: string;
}

export default class EditableBody extends React.PureComponent<EditableBodyProps, EditableBodyState> {
    constructor(props: EditableBodyProps) {
        super(props);

        this.state = {
            content: props.children
        };
    }

    getDerivedStateFromProps(newProps: EditableBodyProps) {
        return {
            content: newProps.children
        };
    }

    render() {
        const { heading, contentType, options } = this.props;
        const { content } = this.state;

        return <EditorContainer className={this.props.className}>
            <EditorHeader>
                { heading }
                <ContentSize content={content} />
            </EditorHeader>
            <TabbedContainer
                defaultSelection={contentType}
                tabNameFormatter={(contentType: string) => {
                    return contentTypeNames[contentType];
                }}
            >{{
                "application/json": isValidJson(content) && <JsonEditor
                    key={'application/json'}
                    options={options}
                    onChange={(content) => this.setState({ content })}
                >{ content }</JsonEditor>,
                "text/plain": <TextEditor
                    key={'text/plain'}
                    options={options}
                    onChange={(content) => this.setState({ content })}
                >{ content }</TextEditor>,
                "application/xml": null,
                "application/octet-stream": null,
                "application/graphql": null,
            }}</TabbedContainer>
        </EditorContainer>;
    }
}