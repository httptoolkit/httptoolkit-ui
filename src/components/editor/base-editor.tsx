import * as _ from 'lodash';
import * as React from 'react';
import { observer, disposeOnUnmount, inject } from 'mobx-react';
import { observable, action, autorun, reaction, comparer } from 'mobx';
import type { SchemaObject } from 'openapi-directory';

import { logError } from '../../errors';
import { Omit } from '../../types';
import { styled } from '../../styles';

import { UiStore } from '../../model/ui/ui-store';
import {
    MonacoTypes,
    MonacoEditorProps,
    MonacoEditor,
    monacoLoadingPromise,
    modelsMarkers,
    reloadMonacoEditor
} from './monaco';

import { FocusWrapper } from './focus-wrapper';
import { buildContextMenuCallback } from './editor-context-menu';


export interface EditorProps extends MonacoEditorProps {
    onContentSizeChange?: (contentUpdate: MonacoTypes.editor.IContentSizeChangedEvent) => void;

    // When this prop changes, the editor layout will be reset. This can be used to indicate a change of the content
    // represented by the editor (which should update state, e.g. the editor content selection) even when editors
    // are reused via portals etc. This is not strictly required in non-reused editors, but it's useful to enforce it
    // here to make sure we handle this correctly in all cases. Can be set to null to explicitly ignore this.
    contentId: string | null;

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

@inject('uiStore')
@observer
export class SelfSizedEditor extends React.Component<
    Omit<EditorProps, 'onContentSizeChange'> & {
        expanded?: boolean,
        uiStore?: UiStore // Injected automatically
    }
> {

    container = React.createRef<HTMLDivElement>();
    editor = React.createRef<BaseEditor>();

    @action.bound
    onContentSizeChange(contentUpdate: MonacoTypes.editor.IContentSizeChangedEvent) {
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
    }

    componentWillUnmount() {
        this.resizeObserver.disconnect();
    }

    @observable contentHeight: number = 0;

    render() {
        return <EditorMaxHeightContainer
            ref={this.container}
            expanded={!!this.props.expanded}
            style={{ 'height': this.contentHeight + 'px' }}
            onContextMenu={buildContextMenuCallback(
                this.props.uiStore!,
                !!this.props.options?.readOnly,
                this.editor
            )}
        >
            <BaseEditor
                theme={this.props.uiStore!.theme.monacoTheme}
                {...this.props}
                ref={this.editor}
                onContentSizeChange={this.onContentSizeChange}
            />
        </EditorMaxHeightContainer>
    }
}

// As opposed to self-sized - when not expanded, the container-sized
const ContainerSizedEditorContainer = styled.div`
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
            height: 100%;
        `
    }
`;

@inject('uiStore')
@observer
export class ContainerSizedEditor extends React.Component<
    Omit<EditorProps, 'onContentSizeChange'> & {
        expanded?: boolean,
        uiStore?: UiStore // Injected automatically
    }
> {

    container = React.createRef<HTMLDivElement>();
    editor = React.createRef<BaseEditor>();

    onResize = _.throttle(() => {
        if (this.editor.current) this.editor.current.relayout();
    }, 25, { leading: true, trailing: true });

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
    }

    componentWillUnmount() {
        this.resizeObserver.disconnect();
    }

    render() {
        return <ContainerSizedEditorContainer
            ref={this.container}
            expanded={!!this.props.expanded}
            onContextMenu={buildContextMenuCallback(
                this.props.uiStore!,
                !!this.props.options?.readOnly,
                this.editor
            )}
        >
            <BaseEditor
                theme={this.props.uiStore!.theme.monacoTheme}
                {...this.props}
                ref={this.editor}
            />
        </ContainerSizedEditorContainer>
    }
}

const EditorFocusWrapper = styled(FocusWrapper)`
    height: 100%;
    width: 100%;
`;

@observer
class BaseEditor extends React.Component<EditorProps> {

    // Both provided async, once the editor has initialized
    editor: MonacoTypes.editor.IStandaloneCodeEditor | undefined;
    monaco: (typeof MonacoTypes) | undefined;

    @observable
    monacoEditorLoaded = !!MonacoEditor;

    @observable
    modelUri: MonacoTypes.Uri | undefined = undefined;

    registeredSchemaUri: string | undefined = undefined;

    constructor(props: EditorProps) {
        super(props);

        if (!this.monacoEditorLoaded) {
            monacoLoadingPromise
                // Did it fail before? Retry it now, just in case
                .catch(() => reloadMonacoEditor())
                .then(action(() => this.monacoEditorLoaded = true));
        }

        reaction(() => this.props.contentId, () => this.resetUIState());
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

    private getMarkerController() {
        return this.editor?.getContribution('editor.contrib.markerController') as unknown as {
            showAtMarker(marker: MonacoTypes.editor.IMarker): void;
            close(focus: boolean): void;
        };
    }

    private withoutFocusingEditor(cb: () => void) {
        if (!this.editor) return;
        const originalFocusMethod = this.editor.focus;
        this.editor.focus = () => {};
        cb();
        this.editor.focus = originalFocusMethod;
    }

    private async resetUIState() {
        if (this.editor && this.monaco) {
            this.editor.setSelection(
                new this.monaco.Selection(0, 0, 0, 0)
            );

            this.relayout();

            requestAnimationFrame(() => {
                if (this.editor && this.monaco) {
                    // Sometimes, if the value updates immediately, the above results in us
                    // selecting *all* content. We reset again after a frame to avoid that.
                    this.editor.setSelection(new this.monaco.Selection(0, 0, 0, 0));
                }

                // Clear open problems - without this, expanded markers (squiggly line -> View Problem)
                // will persist even though the marker itself no longer exists in the content.
                this.getMarkerController()?.close(false);
            });
        }
    }

    @action.bound
    onEditorDidMount(editor: MonacoTypes.editor.IStandaloneCodeEditor, monaco: typeof MonacoTypes) {
        this.editor = editor;
        this.monaco = monaco;

        const model = editor.getModel();
        this.modelUri = model?.uri;

        this.editor.onDidChangeModel(action((e: MonacoTypes.editor.IModelChangedEvent) => {
            this.modelUri = e.newModelUrl ?? undefined;
        }));

        if (this.props.onContentSizeChange) {
            this.editor.onDidContentSizeChange(this.props.onContentSizeChange);
        }

        // For read-only editors, we want to manually highlight the inline errors, if there are
        // any. Mostly relevant to OpenAPI body validation issues. We can't do this in reset or
        // elsewhere, as markers update slightly asynchronously from content changes, so this is
        // only visible by observing modelMarkers.
        disposeOnUnmount(this, reaction(() => ({
            markers: (this.modelUri && modelsMarkers.get(this.modelUri)) ?? []
        }), ({ markers }) => {
            if (markers.length && this.props.options?.readOnly) {
                requestAnimationFrame(() => { // Run after the reset marker.close() update
                    this.withoutFocusingEditor(() => {
                        this.getMarkerController().showAtMarker(markers[0]);
                    });
                });
            }
        }, { equals: comparer.structural }));
    }

    componentDidMount() {
        // We don't run _after_ unmount, so we'll leave behind schemas on unmount, which isn't great...
        disposeOnUnmount(this, autorun(() => {
            if (!this.editor || !this.monaco) return;

            // Update the set of JSON schemas recognized by Monaco, to potentially include this file's
            // schema (from props.newSchema) linked to its model URI, or remove our stale schemas.

            const existingOptions = this.monaco.languages.json.jsonDefaults.diagnosticsOptions;
            let newSchemaMappings: SchemaMapping[] = existingOptions.schemas || [];

            const uriString = this.modelUri?.toString();

            if (uriString) {
                const newSchema = this.props.schema;

                const existingMapping = _.find(existingOptions.schemas || [],
                    (sm: SchemaMapping) => sm.uri === uriString
                ) as SchemaMapping | undefined;

                if (newSchema && (!existingMapping || existingMapping.schema !== newSchema)) {
                    // If we have a replacement/new schema for this file, replace/add it.
                    newSchemaMappings = newSchemaMappings
                        .filter((sm) => sm !== existingMapping)
                        .concat({ uri: uriString, fileMatch: [uriString], schema: newSchema });
                } else if (!newSchema) {
                    // If we have no schema for this file, drop the schema
                    newSchemaMappings = newSchemaMappings
                        .filter((sm) => sm !== existingMapping);
                }
            }

            if (this.registeredSchemaUri && uriString != this.registeredSchemaUri) {
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

            this.registeredSchemaUri = uriString;
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

            this.registeredSchemaUri = undefined;
        }
    }

    render() {
        if (!this.monacoEditorLoaded || !MonacoEditor) {
            logError('Monaco editor failed to load');
            return null;
        }

        const options: MonacoTypes.editor.IEditorConstructionOptions = {
            showFoldingControls: 'always',

            scrollbar: {
                alwaysConsumeMouseWheel: false
            },

            quickSuggestions: false,
            parameterHints: { enabled: false },
            codeLens: true,
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