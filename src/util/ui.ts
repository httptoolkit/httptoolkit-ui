import * as React from 'react';
import { useHotkeys as rawUseHotkeys } from "react-hotkeys-hook";
import { action, observable } from 'mobx';

import { desktopVersion } from '../services/service-versions';
import { getDeferred, delay } from './promise';
import { logError } from '../errors';

export function isReactElement(node: any): node is React.ReactElement {
    return node && !!node.$$typeof;
}

export const windowSize = observable({
    height: window.innerHeight,
    width: window.innerWidth
});
window.addEventListener('resize', action(() => {
    windowSize.height = window.innerHeight;
    windowSize.width = window.innerWidth;
}));

export const Ctrl = navigator.platform.startsWith('Mac')
    ? '⌘'
    : 'Ctrl';

export function isCmdCtrlPressed(event: React.KeyboardEvent<unknown>) {
    return navigator.platform.startsWith('Mac')
        ? event.metaKey
        : event.ctrlKey;
}

// Is the element an editable field, for which we shouldn't add keyboard shortcuts?
// We don't worry about readonly, because that might still be surprising.
export const isEditable = (target: EventTarget | null) => {
    if (!target) return false;
    const element = target as HTMLElement;
    const tagName = element.tagName;
    return element.isContentEditable ||
        tagName === 'TEXTAREA' ||
        tagName === 'INPUT' ||
        tagName === 'SELECT';
}

export const useHotkeys = (keys: string, callback: (event: KeyboardEvent) => void, deps: any[]) =>
    rawUseHotkeys(keys, callback, { filter: () => true }, deps);

export function saveFile(
    filename: string,
    mimeType: string,
    content: string | Buffer
): void {
    const element = document.createElement('a');

    const data = new Blob([content], { type: mimeType });

    const objectUrl = window.URL.createObjectURL(data);
    element.setAttribute('href', objectUrl);
    element.setAttribute('download', filename);

    element.style.display = 'none';

    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    // Stop persisting the data. In theory we could do this immediately, as the spec says
    // existing requests will be fine, but let's wait a few seconds to make sure the
    // request has definitely fired properly:
    setTimeout(() => window.URL.revokeObjectURL(objectUrl), 10000);
}

type FileReaderType = 'text' | 'arraybuffer' | 'path';

// Ask the user for a file of one of the given types, and get the raw arraybuffer data
export function uploadFile(type: 'arraybuffer', acceptedMimeTypes?: string[]): Promise<ArrayBuffer | null>
// Ask the user for a file of one of the given types, and get the utf8 text data
export function uploadFile(type: 'text', acceptedMimeTypes?: string[]): Promise<string | null>;
// Ask the user for a file of one of the given types, and get the file path itself (electron only)
export function uploadFile(type: 'path', acceptedMimeTypes?: string[]): Promise<string | null>;
// Note that in general, in most cases this will not resolve when the picker is cancelled (instead,
// it'll only resolve as null after a 10 minute time out) so handle accordingly!
export function uploadFile(
    type: FileReaderType = 'arraybuffer',
    acceptedMimeTypes: string[] = []
): Promise<ArrayBuffer | string | null> {
    if (type === 'path' && !desktopVersion.value) {
        try {
            const promptResult = window.prompt(
                "Path selection can only be used from Electron. Please enter a path manually:"
            )
            return Promise.resolve(promptResult);
        } catch (e) {
            if ((e as Error)?.message?.includes("prompt() is and will not be supported")) {
                // Somehow we've tried to trigger prompt() in Electron - presumably we haven't
                // detected the desktop app info yet for some reason. Never mind though, in
                // this case its safe to swallow this, continue, and do Electron things anyway.
                console.warn("Unexpected Electron prompt() error");
            } else {
                return Promise.reject(e);
            }
        }
    }

    const fileInput = document.createElement('input');
    fileInput.setAttribute('type', 'file');
    if (acceptedMimeTypes.length > 0) {
        fileInput.setAttribute('accept', acceptedMimeTypes.join(','));
    }

    const result = getDeferred<ArrayBuffer | string | null>();

    fileInput.addEventListener('change', () => {
        if (!fileInput.files || !fileInput.files.length) {
            // This remains as a backup for cases where this could happen (unclear) but
            // in modern browsers it seems we don't get a change event at all for cancel,
            // and there are no reliable workarounds (monitoring focus doesn't help -
            // pickers are seemingly no longer modal). Assume cancel never resolves.
            return result.resolve(null);
        }

        const file = fileInput.files[0];

        if (type === 'path') {
            // file.path is an Electron-only extra property:
            // https://github.com/electron/electron/blob/master/docs/api/file-object.md
            result.resolve((file as unknown as { path: string }).path);
        } else {
            const fileReader = new FileReader();

            fileReader.addEventListener('load', () => {
                result.resolve(fileReader.result);
            });

            fileReader.addEventListener('error', (error: any) => {
                result.reject(error);
            });

            if (type === 'text') {
                fileReader.readAsText(file);
            } else {
                fileReader.readAsArrayBuffer(file);
            }
        }
    });

    fileInput.click();

    // Hack to avoid unexpected GC of file inputs, so far as possible.
    // See similar issue at https://stackoverflow.com/questions/52103269.
    // Can't use answer there, as we can't reliably detect 'cancel'.
    // Hold a reference until we get the data or 10 minutes passes (for cancel)
    Promise.race([result.promise, delay(1000 * 60 * 10)])
        .catch(() => {})
        .then(() => fileInput.remove());

    return result.promise;
}

export function useSize(ref: React.RefObject<HTMLElement>, defaultValue: number) {
    const [spaceAvailable, setSpaceAvailable] = React.useState(defaultValue);

    React.useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            const container = ref.current;

            if (container) {
                setSpaceAvailable(container.clientWidth);
            } else {
                console.warn("Element resized, but no ref available");
            }
        });

        if (ref.current) {
            resizeObserver.observe(ref.current);
        } else {
            logError("No element to observe for resizing!");
        }

        return () => resizeObserver.disconnect();
    }, []);

    return spaceAvailable;
}

export async function copyToClipboard(textToCopy: string) {
    if (navigator.clipboard) {
        // This will be available on secure domains in supported browsers. It requires
        // permissions, but not during Electron usage. We ignore permissions here -
        // if this fails (on secure web usage outside Electron) we'll use the fallback.
        try {
            await navigator.clipboard.writeText(textToCopy);
            return; // If this succeeds, we're done
        } catch (e) {
            console.warn('Copy to clipboard with navigator.clipboard failed', e);
            // Didn't succeed - keep going
        }
    }

    // This should work everywhere, as long as this method is called from an
    // event handler:
    const textArea = document.createElement("textarea");
    try {
        textArea.value = textToCopy;
        textArea.style.position = "absolute";
        textArea.style.left = "-9999px";

        document.body.prepend(textArea);
        textArea.select();
        document.execCommand('copy');
    } catch (e) {
        console.warn('Copy to clipboard fallback failed', e);
        throw e;
    } finally {
        textArea.remove();
    }
}