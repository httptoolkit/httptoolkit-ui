import * as React from 'react';
import * as _ from 'lodash';
import { observer } from 'mobx-react';
import { observable, action, computed } from 'mobx';

import {
    js as beautifyJs,
    html as beautifyHtml,
    css as beautifyCss
} from 'js-beautify/js/lib/beautifier';
import * as beautifyXml from 'xml-beautifier';

import { BaseEditor } from './base-editor';
import { styled } from '../../styles';
import { HtkContentType } from '../../content-types';

interface EditorFormat {
    language: string;
    render(content: Buffer): string;
}

export function getContentEditorName(contentType: HtkContentType): string {
    return contentType === 'raw' ? 'Hex' : _.capitalize(contentType);
}

export const EditorFormats: {
    [key in HtkContentType]?:
        | EditorFormat
        | React.ComponentType<{ content: Buffer, rawContentType: string }>
} = {
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
    image: styled.img.attrs<{ content: Buffer, rawContentType: string }>({
        src: (p: { content: Buffer, rawContentType: string }) =>
            `data:${p.rawContentType};base64,${p.content.toString('base64')}`
    })`
        display: block;
        max-width: 100%;
        margin: 0 auto;
    `
};

interface ContentEditorProps {
    children: Buffer;
    rawContentType: string;
    contentType: HtkContentType
}

const EditorContainer = styled.div`
    height: ${(p: { height: number }) => p.height}px;
    max-height: 560px;
`;

function isEditorFormat(input: any): input is EditorFormat {
    return !!input.language;
}

@observer
export class ContentEditor extends React.Component<ContentEditorProps> {

    @observable lineCount: number = 0;

    constructor(props: ContentEditorProps) {
        super(props);
    }

    @computed
    private get editorFormat() {
        return EditorFormats[this.props.contentType] || EditorFormats.text!;
    }

    @computed
    private get renderedContent() {
        if (isEditorFormat(this.editorFormat)) {
            return this.editorFormat.render(this.props.children);
        }
    }

    @action.bound
    updateLineCount(newLineCount: number) {
        this.lineCount = newLineCount;
    }

    render() {
        if (isEditorFormat(this.editorFormat)) {
            try {
                return <EditorContainer height={this.lineCount * 22}>
                    <BaseEditor
                        // For now, we only support read only content
                        options={{readOnly: true}}
                        language={this.editorFormat.language}
                        onLineCount={this.updateLineCount}
                        value={this.renderedContent!}
                    />
                </EditorContainer>;
            } catch (e) {
                return <div>
                    Failed to render {this.props.contentType} content:<br/>
                    {e.toString()}
                </div>
            }
        } else {
            const Viewer = this.editorFormat;
            return <Viewer content={this.props.children} rawContentType={this.props.rawContentType} />
        }
    }
}
