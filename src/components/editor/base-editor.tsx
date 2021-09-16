import * as _ from 'lodash';
import * as React from 'react';
import { observer, disposeOnUnmount } from 'mobx-react';
import { observable, action, autorun } from 'mobx';
import { withTheme } from 'styled-components';
import type { SchemaObject } from 'openapi-directory';

import type * as monacoTypes from 'monaco-editor';
import type { default as _MonacoEditor, MonacoEditorProps } from 'react-monaco-editor';

import { reportError } from '../../errors';
import { delay } from '../../util/promise';
import { Omit } from '../../types';
import { styled, Theme, defineMonacoThemes } from '../../styles';
import { FocusWrapper } from './focus-wrapper';


let MonacoEditor: typeof _MonacoEditor | undefined;
// Defer loading react-monaco-editor ever so slightly. This has two benefits:
// * don't delay first app start waiting for this massive chunk to load
// * better caching (app/monaco-editor bundles can update independently)
let rmeModulePromise = delay(100).then(() => loadMonacoEditor());

async function loadMonacoEditor(retries = 5): Promise<void> {
    try {
        // These might look like two sequential requests, but since they're a single chunk,
        // it's actually just one load and then both will fire together.
        const rmeModule = await import(/* webpackChunkName: "react-monaco-editor" */ 'react-monaco-editor');
        const monacoEditorModule = await import(/* webpackChunkName: "react-monaco-editor" */ 'monaco-editor/esm/vs/editor/editor.api');

        defineMonacoThemes(monacoEditorModule);
        MonacoEditor = rmeModule.default;
    } catch (err) {
        console.log('Monaco load failed', err.message);
        if (retries <= 0) {
            console.warn('Repeatedly failed to load monaco editor, giving up');
            throw err;
        }

        return loadMonacoEditor(retries - 1);
    }
}

export interface EditorProps extends MonacoEditorProps {
    onContentSizeChange?: (contentUpdate: monacoTypes.editor.IContentSizeChangedEvent) => void;
    schema?: SchemaObject;
}

// Extracted unnamed type from Monaco
interface SchemaMapping {
    readonly uri: string;
    readonly fileMatch?: string[];
    readonly schema?: any;
}

const MAX_HEIGHT = 560;

const EditorMaxHeightContainer = styled.div`
    ${(p: { expanded: boolean }) => p.expanded
        ? `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            height: auto !important;
        `
        : `
            max-height: ${MAX_HEIGHT}px;
        `
    }
`;

@observer
export class SelfSizedBaseEditor extends React.Component<
    Omit<EditorProps, 'onContentSizeChange'> & {
        expanded?: boolean
    }
> {

    container = React.createRef<HTMLDivElement>();
    editor = React.createRef<BaseEditor>();

    @action.bound
    onContentSizeChange(contentUpdate: monacoTypes.editor.IContentSizeChangedEvent) {
        this.contentHeight = Math.min(contentUpdate.contentHeight, MAX_HEIGHT);
    }

    onResize = _.throttle(() => {
        if (this.editor.current) this.editor.current.relayout();
    }, 50, { leading: true, trailing: true });

    componentDidUpdate() {
        // Relayout after update, to ensure the editor is always using the full available
        // size even as the editor content changes
        if (this.editor.current) this.editor.current.relayout();
    }

    resizeObserver = new ResizeObserver(this.onResize);

    componentDidMount() {
        if (this.container.current) {
            this.resizeObserver.observe(this.container.current);
        }
        this.resetUIState();
    }

    componentWillUnmount() {
        this.resizeObserver.disconnect();
    }

    public resetUIState() {
        this.editor.current?.resetUIState();
    }

    @observable contentHeight: number = 0;

    render() {
        return <EditorMaxHeightContainer
            ref={this.container}
            expanded={!!this.props.expanded}
            style={{ 'height': this.contentHeight + 'px' }}
        >
            <BaseEditor
                {...this.props}
                ref={this.editor}
                onContentSizeChange={this.onContentSizeChange}
            />
        </EditorMaxHeightContainer>
    }
}

export const ThemedSelfSizedEditor = withTheme(
    React.forwardRef(
        (
            { theme, ...otherProps }: {
                theme?: Theme,
                expanded?: boolean
            } & Omit<EditorProps, 'onContentSizeChange' | 'theme'>,
            ref: React.Ref<SelfSizedBaseEditor>
        ) => <SelfSizedBaseEditor theme={theme!.monacoTheme} ref={ref} {...otherProps} />
    )
);

const EditorFocusWrapper = styled(FocusWrapper)`
    height: 100%;
    width: 100%;
`;

@observer
export class BaseEditor extends React.Component<EditorProps> {

    // Both provided async, once the editor has initialized
    editor: monacoTypes.editor.IStandaloneCodeEditor | undefined;
    monaco: (typeof monacoTypes) | undefined;

    @observable
    monacoEditorLoaded = !!MonacoEditor;

    @observable
    modelUri: string | null = null;

    registeredSchemaUri: string | null = null;

    constructor(props: EditorProps) {
        super(props);

        if (!this.monacoEditorLoaded) {
            rmeModulePromise
                // Did it fail before? Retry it now, just in case
                .catch(() => {
                    rmeModulePromise = loadMonacoEditor(0);
                    return rmeModulePromise;
                })
                .then(action(() => this.monacoEditorLoaded = true));
        }
    }

    public relayout() {
        if (this.editor) {
            try {
                this.editor.layout();
            } catch (e) {
                // Monaco can throw some irrelevant errors here, due to race conditions with
                // layout and model updates etc. It's OK if the layout very occasionally goes
                // funky whilst things are going on, and there's nothing we can do about it,
                // and it'll resolve itself on the next layout, so we just ignore it.
                console.log('Monaco layout error:', e);
                return;
            }
        }
    }

    public async resetUIState() {
        if (this.editor && this.monaco) {
            this.editor.setSelection(
                new this.monaco.Selection(0, 0, 0, 0)
            );
            requestAnimationFrame(() => {
                // Sometimes, if the value updates immediately, the above results in us
                // selecting *all* content. We reset again after a frame to avoid that.
                if (this.editor && this.monaco) {
                    this.editor.setSelection(new this.monaco.Selection(0, 0, 0, 0));
                }
            });

            this.relayout();
        }
    }

    @action.bound
    onEditorDidMount(editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: typeof monacoTypes) {
        this.editor = editor;
        this.monaco = monaco;

        const model = editor.getModel();
        this.modelUri = model && model.uri.toString();

        this.editor.onDidChangeModel(action((e: monacoTypes.editor.IModelChangedEvent) => {
            this.modelUri = e.newModelUrl && e.newModelUrl.toString()
        }));

        if (this.props.onContentSizeChange) {
            this.editor.onDidContentSizeChange(this.props.onContentSizeChange);
        }
    }

    componentDidMount() {
        // We don't run _after_ unmount, so we'll leave behind schemas on unmount, which isn't great...
        disposeOnUnmount(this, autorun(() => {
            if (!this.editor || !this.monaco) return;

            // Update the set of JSON schemas recognized by Monaco, to potentially include this file's
            // schema (from props.newSchema) linked to its model URI, or remove our stale schemas.

            const existingOptions = this.monaco.languages.json.jsonDefaults.diagnosticsOptions;
            let newSchemaMappings: SchemaMapping[] = existingOptions.schemas || [];

            if (this.modelUri) {
                const newSchema = this.props.schema;

                const existingMapping = _.find(existingOptions.schemas || [],
                    (sm: SchemaMapping) => sm.uri === this.modelUri
                ) as SchemaMapping | undefined;

                if (newSchema && (!existingMapping || existingMapping.schema !== newSchema)) {
                    // If we have a replacement/new schema for this file, replace/add it.
                    newSchemaMappings = newSchemaMappings
                        .filter((sm) => sm !== existingMapping)
                        .concat({ uri: this.modelUri, fileMatch: [this.modelUri], schema: newSchema });
                } else if (!newSchema) {
                    // If we have no schema for this file, drop the schema
                    newSchemaMappings = newSchemaMappings
                        .filter((sm) => sm !== existingMapping);
                }
            }

            if (this.registeredSchemaUri && this.modelUri != this.registeredSchemaUri) {
                // If we registered a previous schema for a different model, clear it up.
                newSchemaMappings = newSchemaMappings
                    .filter((sm) => sm.uri !== this.registeredSchemaUri);
            }

            const options = Object.assign({}, existingOptions, {
                validate: true,
                schemas: newSchemaMappings
            });

            if (!_.isEqual(existingOptions, options)) {
                // Avoid unnecessary calls to this, as it reloads the JSON worker
                this.monaco.languages.json.jsonDefaults.setDiagnosticsOptions(options);
            }

            this.registeredSchemaUri = this.modelUri;
        }));
    }

    componentWillUnmount() {
        if (this.editor && this.monaco && this.registeredSchemaUri) {
            // When we unmount, clear our registered schema, if we have one.
            const existingOptions = this.monaco.languages.json.jsonDefaults.diagnosticsOptions;

            const newSchemaMappings = (existingOptions.schemas || [])
                .filter((sm) => sm.uri !== this.registeredSchemaUri);

            const newOptions = Object.assign({}, existingOptions, {
                schemas: newSchemaMappings
            });

            if (!_.isMatch(existingOptions, newOptions)) {
                this.monaco.languages.json.jsonDefaults.setDiagnosticsOptions(newOptions);
            }

            this.registeredSchemaUri = null;
        }
    }

    render() {
        if (!this.monacoEditorLoaded || !MonacoEditor) {
            reportError('Monaco editor failed to load');
            return null;
        }

        const options: monacoTypes.editor.IEditorConstructionOptions = {
            showFoldingControls: 'always',

            quickSuggestions: false,
            parameterHints: { enabled: false },
            codeLens: false,
            minimap: { enabled: false },
            contextmenu: false,
            scrollBeyondLastLine: false,
            colorDecorators: false,
            renderValidationDecorations: 'on',

            // TODO: Would like to set a fontFace here, but due to
            // https://github.com/Microsoft/monaco-editor/issues/392
            // it breaks wordwrap

            fontSize: 16,
            wordWrap: 'on',

            ...this.props.options
        };

        if (!options.readOnly) {
            return <EditorFocusWrapper>
                <MonacoEditor
                    {...this.props}
                    options={options}
                    editorDidMount={this.onEditorDidMount}
                />
            </EditorFocusWrapper>;
        } else {
            // Read-only editors don't capture tab/shift-tab, so don't need
            // any special focus management.
            return <MonacoEditor
                {...this.props}
                options={options}
                editorDidMount={this.onEditorDidMount}
            />;
        }
    }
}