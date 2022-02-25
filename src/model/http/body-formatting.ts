import { styled } from '../../styles';

import { ViewableContentType } from './content-types';
import { ObservablePromise, observablePromise } from '../../util/observable';

import type { WorkerFormatterKey } from '../../services/ui-worker-formatters';
import { formatBufferAsync } from '../../services/ui-worker-api';
import { ReadOnlyParams } from '../../components/common/editable-params';

export interface EditorFormatter {
    language: string;
    cacheKey: Symbol;
    render(content: Buffer): string | ObservablePromise<string>;
}

type FormatComponentProps = {
    expanded: boolean,
    content: Buffer,
    rawContentType: string | undefined
};

type FormatComponent = React.ComponentType<FormatComponentProps>;;

type FormatComponentConfig = {
    scrollable?: true;
    Component: FormatComponent;
};

type Formatter = EditorFormatter | FormatComponentConfig;

export function isEditorFormatter(input: any): input is EditorFormatter {
    return !!input.language;
}

const buildAsyncRenderer = (formatKey: WorkerFormatterKey) =>
    (input: Buffer) => observablePromise(
        formatBufferAsync(input, formatKey)
    );

export const Formatters: { [key in ViewableContentType]: Formatter } = {
    raw: {
        language: 'text',
        cacheKey: Symbol('raw'),
        render: buildAsyncRenderer('raw')
    },
    text: {
        language: 'text',
        cacheKey: Symbol('text'),
        render: (input: Buffer) => {
            return input.toString('utf8');
        }
    },
    base64: {
        language: 'text',
        cacheKey: Symbol('base64'),
        render: buildAsyncRenderer('base64')
    },
    markdown: {
        language: 'markdown',
        cacheKey: Symbol('markdown'),
        render: buildAsyncRenderer('markdown')
    },
    yaml: {
        language: 'yaml',
        cacheKey: Symbol('yaml'),
        render: buildAsyncRenderer('yaml')
    },
    html: {
        language: 'html',
        cacheKey: Symbol('html'),
        render: buildAsyncRenderer('html')
    },
    xml: {
        language: 'xml',
        cacheKey: Symbol('xml'),
        render: buildAsyncRenderer('xml')
    },
    json: {
        language: 'json',
        cacheKey: Symbol('json'),
        render: buildAsyncRenderer('json')
    },
    javascript: {
        language: 'javascript',
        cacheKey: Symbol('javascript'),
        render: buildAsyncRenderer('javascript')
    },
    css: {
        language: 'css',
        cacheKey: Symbol('css'),
        render: buildAsyncRenderer('css')
    },
    'url-encoded': {
        scrollable: true,
        Component: styled(ReadOnlyParams).attrs((p: FormatComponentProps) => ({
            content: p.content.toString('utf8')
        }))`
            padding: 5px;
        ` as FormatComponent
    },
    image: {
        Component: styled.img.attrs((p: FormatComponentProps) => ({
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
        `
    }
};
