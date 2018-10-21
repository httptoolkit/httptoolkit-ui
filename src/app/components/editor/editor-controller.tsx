import * as React from 'react';
import * as _ from 'lodash';
import { observer } from 'mobx-react';
import { observable, action } from 'mobx';

import * as monacoEditor from 'monaco-editor';

import { TextEditor } from './text-editor';
import { JsonEditor } from './json-editor';
import { BaseEditor } from './base-editor';

interface EditorBuildArgs {
    editor: React.ReactNode;
    contentTypeSelector: React.ReactNode;
    lineCount: number;
};

interface EditorControllerProps {
    content: string;
    contentType?: string;
    children: (args: EditorBuildArgs) => React.ReactNode;

    options?: monacoEditor.editor.IEditorConstructionOptions;
    onChange?: (newContent: string) => void;
}

interface ContentTypeConfig<E extends typeof BaseEditor = typeof BaseEditor> {
    name: string;
    editor: E;
}

const ContentTypes = {
    'text/plain': { name: 'Text', editor: TextEditor },
    'application/json': { name: 'JSON', editor: JsonEditor }
} as { [key: string]: ContentTypeConfig };

@observer
export class EditorController extends React.Component<EditorControllerProps> {

    @observable lineCount: number;
    @observable selectedContentType: string;

    constructor(props: EditorControllerProps) {
        super(props);

        this.selectedContentType = ContentTypes[props.contentType!] ?
            props.contentType! : 'text/plain',
        this.lineCount = this.props.content.split('\n').length;
    }

    @action.bound
    updateLineCount(newLineCount: number) {
        this.lineCount = newLineCount;
    }

    @action.bound
    setContentType(changeEvent: React.ChangeEvent<HTMLSelectElement>) {
        let newContentType = changeEvent.target.value;

        this.selectedContentType = newContentType;
    }

    render() {
        const renderer = this.props.children;
        const options = _.defaults(this.props.options, {
            automaticLayout: true,
            readOnly: true,
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

        const contentTypeSelector = <select onChange={this.setContentType} value={this.selectedContentType}>
            { _.map(ContentTypes, ((typeConfig, contentType) => (
                <option key={contentType} value={contentType}>
                    { typeConfig.name }
                </option>
            ))) }
        </select>;

        const EditorClass = ContentTypes[this.selectedContentType].editor;

        const editor = <EditorClass
            onChange={this.props.onChange}
            onLineCount={this.updateLineCount}
            options={options}
        >
            { this.props.content }
        </EditorClass>

        return renderer({
            editor,
            contentTypeSelector,
            lineCount: this.lineCount
        });
    }
}