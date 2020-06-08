import {
    js as beautifyJs,
    html as beautifyHtml,
    css as beautifyCss
} from 'js-beautify/js/lib/beautifier';
import * as beautifyXml from 'xml-beautifier';

import { styled } from '../../styles';
import { ViewableContentType } from './content-types';
import { getReadableSize } from './bodies';

interface EditorFormatter {
    language: string;
    cacheKey: Symbol;
    render(content: Buffer): string;
}

type FormatComponentProps = {
    expanded: boolean,
    content: Buffer,
    rawContentType: string | undefined
};

type FormatComponent = React.ComponentType<FormatComponentProps>;

type Formatter = EditorFormatter | FormatComponent;

export function isEditorFormatter(input: any): input is EditorFormatter {
    return !!input.language;
}

const truncationMarker = (length: number) => `\n[-- Truncated to ${getReadableSize(length, false)} --]`;
const FIVE_MB = 1024 * 1024 * 5;

export const Formatters: { [key in ViewableContentType]: Formatter } = {
    raw: {
        language: 'text',
        cacheKey: Symbol('raw'),
        // Poor man's hex editor:
        render(content: Buffer) {
            // Truncate the content if necessary. Nobody should manually dig
            // through more than 5MB of content, and the full content is
            // available by downloading the whole body.
            const needsTruncation = content.length > FIVE_MB;
            if (needsTruncation) {
                content = content.slice(0, FIVE_MB)
            }

            const formattedContent =
                 content.toString('hex')
                    .replace(/(\w\w)/g, '$1 ')
                    .trimRight();

            if (needsTruncation) {
                return formattedContent + truncationMarker(FIVE_MB);
            } else {
                return formattedContent;
            }
        }
    },
    text: {
        language: 'text',
        cacheKey: Symbol('text'),
        render(content: Buffer) {
            return content.toString('utf8');
        }
    },
    base64: {
        language: 'text',
        cacheKey: Symbol('base64'),
        render(content: Buffer) {
            return Buffer.from(content.toString('utf8'), 'base64').toString('utf8');
        }
    },
    markdown: {
        language: 'markdown',
        cacheKey: Symbol('markdown'),
        render(content: Buffer) {
            return content.toString('utf8');
        }
    },
    yaml: {
        language: 'yaml',
        cacheKey: Symbol('yaml'),
        render(content: Buffer) {
            return content.toString('utf8');
        }
    },
    html: {
        language: 'html',
        cacheKey: Symbol('html'),
        render(content: Buffer) {
            return beautifyHtml(content.toString('utf8'), {
                indent_size: 2
            });
        }
    },
    xml: {
        language: 'xml',
        cacheKey: Symbol('xml'),
        render(content: Buffer) {
            return beautifyXml(content.toString('utf8'), '  ');
        }
    },
    json: {
        language: 'json',
        cacheKey: Symbol('json'),
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
        cacheKey: Symbol('javascript'),
        render(content: Buffer) {
            return beautifyJs(content.toString('utf8'), {
                indent_size: 2
            });
        }
    },
    css: {
        language: 'css',
        cacheKey: Symbol('css'),
        render(content: Buffer) {
            return beautifyCss(content.toString('utf8'), {
                indent_size: 2
            });
        }
    },
    image: styled.img.attrs((p: FormatComponentProps) => ({
        src: `data:${p.rawContentType || ''};base64,${p.content.toString('base64')}`
    }))`
        display: block;
        max-width: 100%;
        margin: 0 auto;

        ${(p: FormatComponentProps) => p.expanded && `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            max-height: 100%;
        `}
    ` as FormatComponent // Shouldn't be necessary, but somehow TS doesn't work this out
};
