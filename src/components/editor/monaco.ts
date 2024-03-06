import type * as MonacoTypes from 'monaco-editor';
import type { default as _MonacoEditor, MonacoEditorProps } from 'react-monaco-editor';

import { defineMonacoThemes } from '../../styles';

import { delay } from '../../util/promise';
import { asError } from '../../util/error';
import { observable, runInAction } from 'mobx';

export type {
    MonacoTypes,
    MonacoEditorProps
};

export let MonacoEditor: typeof _MonacoEditor | undefined;

// Defer loading react-monaco-editor ever so slightly. This has two benefits:
// * don't delay first app start waiting for this massive chunk to load
// * better caching (app/monaco-editor bundles can update independently)
export let monacoLoadingPromise = delay(100)
    .then(() => loadMonacoEditor());

async function loadMonacoEditor(retries = 5): Promise<void> {
    try {
        // These might look like two sequential requests, but since they're a single webpack
        // chunk, it'll actually just be one load, and then both will fire together.
        const rmeModule = await import('react-monaco-editor');
        const monaco = await import('monaco-editor/esm/vs/editor/editor.api');

        defineMonacoThemes(monaco);

        // Track the currently visible markers per model:
        monaco.editor.onDidChangeMarkers((modelUris) => {
            const markers = monaco.editor.getModelMarkers({});

            runInAction(() => {
                modelsMarkers.clear();
                markers.forEach((marker) => {
                    const modelUri = marker.resource;
                    const markersSoFar = modelsMarkers.get(modelUri) ?? [];
                    markersSoFar.push(marker);
                    modelsMarkers.set(modelUri, markersSoFar);
                });
            });
        });

        monaco.languages.register({
            id: 'protobuf'
        });

        monaco.languages.registerCodeLensProvider("protobuf", {
            provideCodeLenses: function (model, token) {
                return {
                    lenses: [
                        {
                            range: {
                                startLineNumber: 1,
                                startColumn: 1,
                                endLineNumber: 2,
                                endColumn: 1,
                            },
                            id: 'protobuf-decoding-header',
                            command: {
                                id: '', // No actual command defined here
                                title: "Automatically decoded from raw Protobuf data",
                            },
                        },
                    ],
                    dispose: () => {},
                };
            },
            resolveCodeLens: function (model, codeLens, token) {
                return codeLens;
            },
        });

        MonacoEditor = rmeModule.default;
    } catch (err) {
        console.log('Monaco load failed', asError(err).message);
        if (retries <= 0) {
            console.warn('Repeatedly failed to load monaco editor, giving up');
            throw err;
        }

        return loadMonacoEditor(retries - 1);
    }
}

export function reloadMonacoEditor() {
    return monacoLoadingPromise = loadMonacoEditor(0);
}

// We keep a single global observable linking model URIs to their current error marker data,
// updated via a global listener set up in loadMonacoEditor above.
export const modelsMarkers = observable.map<MonacoTypes.Uri, MonacoTypes.editor.IMarker[]>();