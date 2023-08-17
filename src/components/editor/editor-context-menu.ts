import type * as monacoTypes from 'monaco-editor';

import { copyToClipboard } from '../../util/ui';

import { UiStore } from '../../model/ui/ui-store';
import { ContextMenuItem } from '../../model/ui/context-menu';

export function buildContextMenuCallback(
    uiStore: UiStore,
    isReadOnly: boolean,
    // Anon base-editor type to avoid exporting this
    baseEditorRef: React.RefObject<{
        editor: monacoTypes.editor.IStandaloneCodeEditor | undefined
    }>
) {
    return (mouseEvent: React.MouseEvent) => {
        const editor = baseEditorRef.current?.editor;
        if (!editor) return;
        const selection = editor.getSelection();

        const items: ContextMenuItem<void>[] = [];

        if (!isReadOnly) {
            items.push({
                type: 'option',
                label: "Cut",
                enabled: !!selection && !selection.isEmpty(),
                callback: async () => {
                    const selection = editor.getSelection();
                    if (!selection) return;
                    const content = editor.getModel()?.getValueInRange(selection);
                    if (!content) return;

                    await copyToClipboard(content);

                    editor.executeEdits("clipboard", [{
                        range: selection,
                        text: "",
                        forceMoveMarkers: true,
                    }]);
                },
            });
        }

        if (selection && !selection.isEmpty()) {
            items.push({
                type: 'option',
                label: "Copy",
                enabled: !!selection && !selection.isEmpty(),
                callback: () => {
                    const selection = editor.getSelection();
                    if (!selection) return;
                    const content = editor.getModel()?.getValueInRange(selection);
                    if (!content) return;
                    copyToClipboard(content);
                },
            });
        }

        if (selection && !!navigator.clipboard) {
            items.push({
                type: 'option',
                label: "Paste",
                enabled: !isReadOnly,
                callback: async () => {
                    const selection = editor.getSelection();
                    if (!selection) return;
                    const text = await navigator.clipboard.readText();

                    editor.executeEdits("clipboard", [{
                        range: selection,
                        text: text,
                        forceMoveMarkers: true,
                    }]);
                }
            });
        }

        uiStore.handleContextMenuEvent(mouseEvent, items);
    }
}