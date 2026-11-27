import * as React from 'react';
import type * as MonacoTypes from 'monaco-editor';

export interface MonacoEditorProps {
    width?: string | number;
    height?: string | number;
    value?: string | null;
    defaultValue?: string;
    language?: string;
    theme?: string | null;
    className?: string | null;
    options?: MonacoTypes.editor.IStandaloneEditorConstructionOptions;
    editorDidMount?: (
        editor: MonacoTypes.editor.IStandaloneCodeEditor,
        monaco: typeof MonacoTypes
    ) => void;
    onChange?: (value: string, event: MonacoTypes.editor.IModelContentChangedEvent) => void;
}

const processSize = (size: string | number) =>
    !/^\d+$/.test(size.toString()) ? size : `${size}px`;

// A minimal React wrapper for a Monaco editor instance. Takes the Monaco API as an argument,
// so that this can be defined without loading Monaco itself, which is loaded asynchronously.
export function buildMonacoEditor(monaco: typeof MonacoTypes) {
    return class MonacoEditor extends React.Component<MonacoEditorProps> {

        static defaultProps = {
            width: '100%',
            height: '100%',
            value: null,
            defaultValue: '',
            language: 'javascript',
            theme: null,
            options: {},
            className: null
        };

        private containerElement: HTMLDivElement | null = null;
        private editor: MonacoTypes.editor.IStandaloneCodeEditor | undefined;
        private contentChangeSubscription: MonacoTypes.IDisposable | undefined;

        // Set whilst we update the content ourselves, so we don't report that as a change
        private preventTriggerChangeEvent = false;

        private assignRef = (component: HTMLDivElement | null) => {
            this.containerElement = component;
        };

        componentDidMount() {
            if (!this.containerElement) return;

            const { value, defaultValue, language, className, theme, options } = this.props;

            this.editor = monaco.editor.create(this.containerElement, {
                value: value ?? defaultValue,
                language,
                ...(className ? { extraEditorClassName: className } : {}),
                ...options,
                ...(theme ? { theme } : {})
            });

            this.props.editorDidMount?.(this.editor, monaco);

            const editor = this.editor;
            this.contentChangeSubscription = editor.onDidChangeModelContent((event) => {
                if (!this.preventTriggerChangeEvent) {
                    this.props.onChange?.(editor.getValue(), event);
                }
            });
        }

        componentDidUpdate(prevProps: MonacoEditorProps) {
            const { value, language, theme, height, options, width, className } = this.props;
            const editor = this.editor;
            if (!editor) return;
            const model = editor.getModel();

            if (model && value != null && value !== model.getValue()) {
                this.preventTriggerChangeEvent = true;
                editor.pushUndoStop();
                model.pushEditOperations([], [{
                    range: model.getFullModelRange(),
                    text: value
                }], () => null);
                editor.pushUndoStop();
                this.preventTriggerChangeEvent = false;
            }

            if (model && prevProps.language !== language) {
                monaco.editor.setModelLanguage(model, language!);
            }

            if (prevProps.theme !== theme && theme) {
                monaco.editor.setTheme(theme);
            }

            if (width !== prevProps.width || height !== prevProps.height) {
                editor.layout();
            }

            if (prevProps.options !== options) {
                editor.updateOptions({
                    ...(className ? { extraEditorClassName: className } : {}),
                    ...options
                });
            }
        }

        componentWillUnmount() {
            // The editor owns its model (created with the editor), so this disposes both
            this.editor?.dispose();
            this.contentChangeSubscription?.dispose();
        }

        render() {
            const style = {
                width: processSize(this.props.width!),
                height: processSize(this.props.height!)
            };

            return <div
                ref={this.assignRef}
                style={style}
                className='react-monaco-editor-container'
            />;
        }
    };
}
