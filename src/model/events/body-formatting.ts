import { styled } from '../../styles';

import { ViewableContentType } from '../events/content-types';
import { ObservablePromise, observablePromise } from '../../util/observable';
import { bufferToString, bufferToHex } from '../../util/buffer';

import type { WorkerFormatterKey } from '../../services/ui-worker-formatters';
import { formatBufferAsync } from '../../services/ui-worker-api';
import { ReadOnlyParams } from '../../components/common/editable-params';
import { ImageViewer } from '../../components/editor/image-viewer';

export interface EditorFormatter {
    language: string;
    cacheKey: Symbol;
    isEditApplicable: boolean; // Can you apply this manually during editing to format an input?
    render(content: Buffer): string | ObservablePromise<string>;
}

type FormatComponentProps = {
    content: Buffer;
    rawContentType: string | undefined;
};

type FormatComponent = React.ComponentType<FormatComponentProps>;

type FormatComponentConfig = {
    layout: 'scrollable' | 'centered';
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
        isEditApplicable: false,
        render: (input: Buffer) => {
            if (input.byteLength < 2000) {
                try {
                    // For short-ish inputs, we return synchronously - conveniently this avoids
                    // showing the loading spinner that churns the layout in short content cases.
                    return bufferToHex(input);
                } catch (e) {
                    return observablePromise(Promise.reject(e));
                }
            } else {
                return observablePromise(
                    formatBufferAsync(input, 'raw')
                );
            }
        }
    },
    text: {
        language: 'text',
        cacheKey: Symbol('text'),
        isEditApplicable: false,
        render: (input: Buffer) => {
            return bufferToString(input);
        }
    },
    base64: {
        language: 'text',
        cacheKey: Symbol('base64'),
        isEditApplicable: false,
        render: buildAsyncRenderer('base64')
    },
    markdown: {
        language: 'markdown',
        cacheKey: Symbol('markdown'),
        isEditApplicable: false,
        render: buildAsyncRenderer('markdown')
    },
    yaml: {
        language: 'yaml',
        cacheKey: Symbol('yaml'),
        isEditApplicable: false,
        render: buildAsyncRenderer('yaml')
    },
    html: {
        language: 'html',
        cacheKey: Symbol('html'),
        isEditApplicable: true,
        render: buildAsyncRenderer('html')
    },
    xml: {
        language: 'xml',
        cacheKey: Symbol('xml'),
        isEditApplicable: true,
        render: buildAsyncRenderer('xml')
    },
    json: {
        language: 'json',
        cacheKey: Symbol('json'),
        isEditApplicable: true,
        render: (input: Buffer) => {
            if (input.byteLength < 10000) {
                const inputAsString = bufferToString(input);

                try {
                    // For short-ish inputs, we return synchronously - conveniently this avoids
                    // showing the loading spinner that churns the layout in short content cases.
                    return JSON.stringify(
                        JSON.parse(inputAsString),
                    null, 2);
                    // ^ Same logic as in UI-worker-formatter
                } catch (e) {
                    // Fallback to showing the raw un-formatted JSON:
                    return inputAsString;
                }
            } else {
                return observablePromise(
                    formatBufferAsync(input, 'json')
                );
            }
        }
    },
    javascript: {
        language: 'javascript',
        cacheKey: Symbol('javascript'),
        isEditApplicable: true,
        render: buildAsyncRenderer('javascript')
    },
    css: {
        language: 'css',
        cacheKey: Symbol('css'),
        isEditApplicable: true,
        render: buildAsyncRenderer('css')
    },
    protobuf: {
        language: 'protobuf',
        cacheKey: Symbol('protobuf'),
        isEditApplicable: false,
        render: buildAsyncRenderer('protobuf')
    },
    'url-encoded': {
        layout: 'scrollable',
        Component: styled(ReadOnlyParams).attrs((p: FormatComponentProps) => ({
            content: bufferToString(p.content)
        }))`
            padding: 5px;
        ` as FormatComponent
    },
    image: {
        layout: 'centered',
        Component: ImageViewer
    }
};
