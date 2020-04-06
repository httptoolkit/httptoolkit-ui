import * as React from 'react';

import { desktopVersion } from '../services/service-versions';
import { getDeferred, delay } from './promise';
import { reportError } from '../errors';

export function isReactElement(node: any): node is React.ReactElement {
    return node && !!node.$$typeof;
}

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
export function uploadFile(
    type: FileReaderType = 'arraybuffer',
    acceptedMimeTypes: string[] = []
): Promise<ArrayBuffer | string | null> {
    if (type === 'path' && !desktopVersion.value) {
        return Promise.resolve(window.prompt(
            "Path selection can only be used from Electron. Please enter a path manually:"
        ));
    }

    const fileInput = document.createElement('input');
    fileInput.setAttribute('type', 'file');
    if (acceptedMimeTypes.length > 0) {
        fileInput.setAttribute('accept', acceptedMimeTypes.join(','));
    }

    const result = getDeferred<ArrayBuffer | string | null>();

    fileInput.addEventListener('change', () => {
        if (!fileInput.files || !fileInput.files.length) {
            return Promise.resolve(null);
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
                reportError("Element resized, but no ref available");
            }
        });

        if (ref.current) {
            resizeObserver.observe(ref.current);
        } else {
            reportError("No element to observe for resizing!");
        }

        return () => resizeObserver.disconnect();
    }, []);

    return spaceAvailable;
}