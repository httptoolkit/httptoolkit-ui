import * as React from 'react';

import { styled } from '../../styles';

// The backdrop opacity is passed down as a data attribute, rather than a
// normal styled-components prop, because our styled-components version
// (v5.0) forwards unknown props to the DOM element:
const ModalDialog = styled.dialog<{ 'data-backdrop-opacity'?: number }>`
    /* Modal dialogs render in the browser's top layer, centered natively,
       so no positioning or z-index is required. We just reset the default
       chrome, ready for each modal's own styling: */
    padding: 0;
    border: none;
    background: transparent;

    overflow: visible;

    &::backdrop {
        /* This must not use CSS variables: ::backdrop can't inherit custom
           properties from the page in Chromium <122 (i.e. old Electron): */
        background: ${p => p.theme.modalGradient};
        opacity: ${p => p['data-backdrop-opacity'] ?? 0.9};
    }
`;

export interface AppModalProps {
    /**
     * Called when the user tries to dismiss the modal, via Escape or a
     * click on the backdrop. If omitted, those are ignored, making
     * accidental dismissal harder - the modal can then normally only be
     * closed by its own explicit controls.
     */
    onClose?: () => void;
    /** Opacity of the backdrop over the page behind - defaults to 0.9. */
    backdropOpacity?: number;
    className?: string;
    'aria-labelledby'?: string;
    'aria-label'?: string;
    children: React.ReactNode;
}

/**
 * The shared base for all app-wide modals, built on native <dialog> +
 * showModal(). This provides centered top-layer rendering, a styled
 * backdrop, focus trapping, and inertness of the rest of the page - all
 * natively, and all supported back to old Electron. Focus restoration is
 * also covered: we close() the dialog just before unmount, which runs the
 * native close algorithm and so returns focus to the previously focused
 * element.
 *
 * Modals appear & disappear purely by mounting & unmounting this
 * component, driven by app state as usual: it never closes itself, it
 * just calls onClose. Style it via styled(AppModal).
 */
export const AppModal = (props: AppModalProps) => {
    const dialogRef = React.useRef<HTMLDialogElement>(null);

    const onCloseRef = React.useRef(props.onClose);
    onCloseRef.current = props.onClose;

    // Pre-paint, so the dialog never appears in its non-modal in-page state:
    React.useLayoutEffect(() => {
        const dialog = dialogRef.current!;
        dialog.showModal();

        // This can still fire due to force close in some cases:
        const onNativeClose = () => onCloseRef.current?.();
        dialog.addEventListener('close', onNativeClose);

        return () => {
            dialog.removeEventListener('close', onNativeClose);
            dialog.close();
        };
    }, []);

    const { onClose } = props;

    const onCancel = React.useCallback((event: React.SyntheticEvent) => {
        // Never let the dialog close itself natively (e.g. via Escape):
        // mount/unmount is the only show/hide mechanism, so the app state
        // that rendered the modal always stays in sync with what's shown.
        event.preventDefault();
        onClose?.();
    }, [onClose]);

    const onClick = React.useCallback((event: React.MouseEvent) => {
        // Backdrop clicks fire on the dialog element itself. As the dialog
        // has no padding, clicks anywhere within the modal always target a
        // child instead, so this reliably detects only backdrop clicks:
        if (event.target === dialogRef.current) onClose?.();
    }, [onClose]);

    return <ModalDialog
        ref={dialogRef}
        onCancel={onCancel}
        onClick={onClick}
        data-backdrop-opacity={props.backdropOpacity}
        className={props.className}
        aria-labelledby={props['aria-labelledby']}
        aria-label={props['aria-label']}
    >
        { props.children }
    </ModalDialog>;
};
