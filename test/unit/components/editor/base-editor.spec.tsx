import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'mobx-react';

import { expect } from '../../../test-setup';

import { ThemeProvider, lightTheme } from '../../../../src/styles';
import { delay } from '../../../../src/util/promise';
import { SelfSizedEditor } from '../../../../src/components/editor/base-editor';
import { monacoLoadingPromise } from '../../../../src/components/editor/monaco';

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
// Provided by the Monaco webpack plugin in the real app, but not in unit tests:
import 'monaco-editor/esm/vs/language/json/monaco.contribution';

const uiStore = { theme: lightTheme };

type EditorTestProps = {
    value?: string,
    contentId: string | null,
    language?: string,
    readOnly?: boolean,
    onChange?: (value: string) => void
};

describe('Editor', function () {
    this.timeout(20000);

    let container: HTMLDivElement;

    before(async () => {
        await monacoLoadingPromise;
    });

    beforeEach(() => {
        container = document.createElement('div');
        container.style.width = '600px';
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    });

    function renderEditor(props: EditorTestProps) {
        ReactDOM.render(
            <Provider uiStore={uiStore}>
                <ThemeProvider theme={lightTheme}>
                    <div>
                        <SelfSizedEditor
                            contentId={props.contentId}
                            value={props.value}
                            onChange={props.onChange}
                            language={props.language ?? 'text'}
                            options={props.readOnly ? { readOnly: true } : {}}
                        />
                    </div>
                </ThemeProvider>
            </Provider>,
            container
        );
    }

    const getModelFor = (value: string) =>
        monaco.editor.getModels().filter(m => !m.isDisposed() && m.getValue() === value);

    it('should show the initial value', () => {
        renderEditor({ contentId: 'a', value: 'initial content' });
        expect(getModelFor('initial content').length).to.equal(1);
    });

    it('should apply editable changes to the same content as undoable edits', () => {
        renderEditor({ contentId: 'a', value: 'original' });
        const [model] = getModelFor('original');

        renderEditor({ contentId: 'a', value: 'formatted' });

        expect(model.isDisposed()).to.equal(false);
        expect(model.getValue()).to.equal('formatted');
        expect(model.canUndo()).to.equal(true);
    });

    it('should report user edits, without reapplying them when passed back as the value', async () => {
        const changes: string[] = [];
        const onChange = (value: string) => {
            changes.push(value);
            // Pass back an equal but non-identical string, as the Send page does
            renderEditor({ contentId: 'a', value: (' ' + value).slice(1), onChange });
        };
        renderEditor({ contentId: 'a', value: 'hello', onChange });
        const [model] = getModelFor('hello');

        model.applyEdits([{ range: model.getFullModelRange(), text: 'hello world' }]);
        await delay(10);

        expect(changes).to.deep.equal(['hello world']);
        expect(model.isDisposed()).to.equal(false);
        expect(model.getValue()).to.equal('hello world');
    });

    it('should update the language', () => {
        renderEditor({ contentId: 'a', value: '{}', language: 'text' });
        renderEditor({ contentId: 'a', value: '{}', language: 'json' });

        const [model] = getModelFor('{}');
        expect(model.getLanguageId?.() ?? model.getModeId()).to.equal('json');
    });

    it('should dispose its model on unmount', () => {
        renderEditor({ contentId: 'a', value: 'unmounted content', readOnly: true });
        const [model] = getModelFor('unmounted content');

        ReactDOM.unmountComponentAtNode(container);

        expect(model.isDisposed()).to.equal(true);
    });
});
