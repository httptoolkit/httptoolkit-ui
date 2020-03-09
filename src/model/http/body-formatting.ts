import {
    js as beautifyJs,
    html as beautifyHtml,
    css as beautifyCss
} from 'js-beautify/js/lib/beautifier';
import * as beautifyXml from 'xml-beautifier';

import { styled } from '../../styles';
import { ViewableContentType } from './content-types';

interface EditorFormatter {
    language: string;
    render(content: Buffer): string;
}

type FormatComponent = React.ComponentType<{ content: Buffer, rawContentType: string | undefined }>;

type Formatter = EditorFormatter | FormatComponent;

export function isEditorFormatter(input: any): input is EditorFormatter {
    return !!input.language;
}

export const Formatters: { [key in ViewableContentType]: Formatter } = {
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
    base64: {
        language: 'text',
        render(content: Buffer) {
            return Buffer.from(content.toString('utf8'), 'base64').toString('utf8');
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
