import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { expect } from '../../../test-setup';

import { ThemeProvider, lightTheme } from '../../../../src/styles';
import { AppModal } from '../../../../src/components/common/modal';

describe('AppModal', () => {

    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    });

    function renderModal(props: { onClose?: () => void } = {}) {
        ReactDOM.render(
            <ThemeProvider theme={lightTheme}>
                <AppModal {...props}>
                    <button id='inner-button'>Click me</button>
                </AppModal>
            </ThemeProvider>,
            container
        );
        return document.querySelector('dialog') as HTMLDialogElement;
    }

    it('opens as a native modal dialog on mount', () => {
        const dialog = renderModal();

        expect(dialog.open).to.equal(true);
        // showModal() (not just the open attribute) puts it in the top
        // layer, which is what provides backdrop/focus-trap/inertness:
        expect(dialog.matches(':modal')).to.equal(true);
    });

    it('traps focus within the dialog', () => {
        const dialog = renderModal();

        const innerButton = dialog.querySelector('#inner-button') as HTMLButtonElement;
        innerButton.focus();
        expect(document.activeElement).to.equal(innerButton);

        // Content outside the modal can't be focused while it's open:
        const outsideButton = document.createElement('button');
        document.body.appendChild(outsideButton);
        try {
            outsideButton.focus();
            expect(document.activeElement).to.not.equal(outsideButton);
        } finally {
            outsideButton.remove();
        }
    });

    it('calls onClose instead of closing itself when cancelled (e.g. Escape)', () => {
        let closeCount = 0;
        const dialog = renderModal({ onClose: () => closeCount++ });

        // The cancel event is what the browser fires for Escape:
        dialog.dispatchEvent(new Event('cancel', { cancelable: true }));

        expect(closeCount).to.equal(1);
        // The dialog itself must still be open: only unmounting (i.e. the
        // state change made by onClose) should ever hide it:
        expect(dialog.open).to.equal(true);
    });

    it('stays open when cancelled with no onClose set', () => {
        const dialog = renderModal();

        const cancelEvent = new Event('cancel', { cancelable: true });
        dialog.dispatchEvent(cancelEvent);

        expect(cancelEvent.defaultPrevented).to.equal(true);
        expect(dialog.open).to.equal(true);
    });

    it('calls onClose for clicks on the backdrop, but not on content', () => {
        let closeCount = 0;
        const dialog = renderModal({ onClose: () => closeCount++ });

        // Clicks on children (anywhere within the modal) don't close:
        const innerButton = dialog.querySelector('#inner-button') as HTMLButtonElement;
        innerButton.click();
        expect(closeCount).to.equal(0);

        // Clicks targeting the dialog itself (only possible on the
        // backdrop, as the dialog has no padding) do close:
        dialog.click();
        expect(closeCount).to.equal(1);
    });

    it('restores focus to the previously focused element on unmount', () => {
        const outsideButton = document.createElement('button');
        document.body.appendChild(outsideButton);
        try {
            outsideButton.focus();
            expect(document.activeElement).to.equal(outsideButton);

            const dialog = renderModal();
            const innerButton = dialog.querySelector('#inner-button') as HTMLButtonElement;
            innerButton.focus();
            expect(document.activeElement).to.equal(innerButton);

            // On unmount, the native close algorithm runs (just before
            // removal), so focus must return to where it was - not get
            // dropped on <body> as plain element removal would do:
            ReactDOM.unmountComponentAtNode(container);
            expect(document.activeElement).to.equal(outsideButton);
        } finally {
            outsideButton.remove();
        }
    });

    it('resyncs via onClose if the dialog is somehow closed natively', async () => {
        // Normal closes are blocked via the cancel event, but e.g. modern
        // Chromium force-closes dialogs on repeated Escapes regardless:
        let closeCount = 0;
        const dialog = renderModal({ onClose: () => closeCount++ });

        const closed = new Promise<void>(resolve =>
            dialog.addEventListener('close', () => resolve(), { once: true })
        );

        dialog.close();
        await closed;

        expect(closeCount).to.equal(1);
    });

    it('closes fully on unmount', () => {
        const dialog = renderModal();
        expect(document.querySelector('dialog')).to.not.equal(null);

        ReactDOM.unmountComponentAtNode(container);
        expect(document.querySelector('dialog')).to.equal(null);
    });

});
