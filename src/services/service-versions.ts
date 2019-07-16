import { lazyObservablePromise } from "../util";
import { getServerVersion, waitUntilServerReady } from "./server-api";

export const UI_VERSION = process.env.COMMIT_REF || "Unknown";

declare global {
    // Injected by the desktop shell, if we're using in it (rather than a normal browser)
    interface Window { httpToolkitDesktopVersion: string | undefined; }
}

export const desktopVersion = lazyObservablePromise(async () => {
    // In the SW, it's tricky to check the desktop version, as we don't get it injected.
    // For now, just treat it as a different environment
    if (typeof window === 'undefined') return 'service-worker';

    if (window.httpToolkitDesktopVersion) {
        // If it's already been set, just return it
        return window.httpToolkitDesktopVersion;
    } else {
        return new Promise<string>((resolve) => {
            // If not, it might still be coming (there's race here), so listen out
            window.addEventListener('message', (message) => {
                if (message.data.httpToolkitDesktopVersion) {
                    resolve(message.data.httpToolkitDesktopVersion);
                }
            });
        });
    }
    // Note that if we're running in a browser, not the desktop shell, this _never_ resolves.
});

export const serverVersion = lazyObservablePromise(() =>
    waitUntilServerReady().then(getServerVersion)
);

export const PORT_RANGE_SERVER_RANGE = '^0.1.14';