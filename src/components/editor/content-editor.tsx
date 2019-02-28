import * as React from 'react';
import * as _ from 'lodash';
import { observer, disposeOnUnmount } from 'mobx-react';
import { observable, action, computed, IObservableValue, autorun, runInAction } from 'mobx';

import {
    js as beautifyJs,
    html as beautifyHtml,
    css as beautifyCss
} from 'js-beautify/js/lib/beautifier';
import * as beautifyXml from 'xml-beautifier';

import { BaseEditor } from './base-editor';
import { styled } from '../../styles';
import { HtkContentType } from '../../content-types';
import { SchemaObject } from 'openapi3-ts';

interface EditorFormatter {
    language: string;
    render(content: Buffer): string;
}

type FormatComponent = React.ComponentType<{ content: Buffer, rawContentType: string | undefined }>;

type Formatter = EditorFormatter | FormatComponent;

export function getContentEditorName(contentType: HtkContentType): string {
    return contentType === 'raw' ? 'Hex' : _.capitalize(contentType);
}

export const Formatters: { [key in HtkContentType]?: Formatter } = {
    raw: {
        language: 'text',
        // Poor man's hex editor:
        render(content: Buffer) {
            return content.toString('hex').replace(
                /(\w\w)/g, '$1 '
            ).trimRight();
        }
    },
    text: {
        language: 'text',
        render(content: Buffer) {
            return content.toString('utf8');
        }
    },
    markdown: {
        language: 'markdown',
        render(content: Buffer) {
            return content.toString('utf8');
        }
    },
    yaml: {
        language: 'yaml',
        render(content: Buffer) {
            return content.toString('utf8');
        }
    },
    html: {
        language: 'html',
        render(content: Buffer) {
            return beautifyHtml(content.toString('utf8'), {
                indent_size: 2
            });
        }
    },
    xml: {
        language: 'xml',
        render(content: Buffer) {
            return beautifyXml(content.toString('utf8'), '  ');
        }
    },
    json: {
        language: 'json',
        render(content: Buffer) {
            const asString = content.toString('utf8');
            try {
                return JSON.stringify(JSON.parse(asString), null, 2);
            } catch (e) {
                return asString;
            }
        }
    },
    javascript: {
        language: 'javascript',
        render(content: Buffer) {
            return beautifyJs(content.toString('utf8'), {
                indent_size: 2
            });
        }
    },
    css: {
        language: 'css',
        render(content: Buffer) {
            return beautifyCss(content.toString('utf8'), {
                indent_size: 2
            });
        }
    },
    image: styled.img.attrs((p: { content: Buffer, rawContentType: string | undefined }) => ({
        src: `data:${p.rawContentType || ''};base64,${p.content.toString('base64')}`
    }))`
        display: block;
        max-width: 100%;
        margin: 0 auto;
    ` as FormatComponent // Shouldn't be necessary, but somehow TS doesn't work this out
};

interface ContentEditorProps {
    children: Buffer;
    schema?: SchemaObject;
    rawContentType: string | undefined;
    contentType: HtkContentType;
    contentObservable?: IObservableValue<string | undefined>;
    monacoTheme: string
}

const EditorContainer = styled.div`
    height: ${(p: { height: number }) => p.height}px;
    max-height: 560px;
`;

function isEditorFormatter(input: any): input is EditorFormatter {
    return !!input.language;
}

@observer
export class ContentEditor extends React.Component<ContentEditorProps> {

    @observable lineCount: number = 0;

    constructor(props: ContentEditorProps) {
        super(props);
    }

    @computed
    private get formatter() {
        return Formatters[this.props.contentType] || Formatters.text!;
    }

    @computed
    private get renderedContent() {
        if (isEditorFormatter(this.formatter)) {
            return this.formatter.render(this.props.children);
        }
    }

    @action.bound
    updateLineCount(newLineCount: number) {
        this.lineCount = newLineCount;
    }

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            if (this.props.contentObservable) {
                runInAction(() => this.props.contentObservable!.set(this.renderedContent));
            }
        }));
    }

    private readonly editorOptions = {
        readOnly: true
    };

    render() {
        if (isEditorFormatter(this.formatter)) {
            try {
                return <EditorContainer height={this.lineCount * 22}>
                    <BaseEditor
                        // For now, we only support read only content
                        options={this.editorOptions}
                        language={this.formatter.language}
                        onLineCount={this.updateLineCount}
                        value={this.renderedContent!}
                        schema={this.props.schema}
                        theme={this.props.monacoTheme}
                    />
                </EditorContainer>;
            } catch (e) {
                return <div>
                    Failed to render {this.props.contentType} content:<br/>
                    {e.toString()}
                </div>;
            }
        } else {
            const Viewer = this.formatter;
            return <Viewer content={this.props.children} rawContentType={this.props.rawContentType} />;
        }
    }
}
