import { lazyObservablePromise } from "../util";
import { getServerVersion, waitUntilServerReady } from "./server-api";
import { getDesktopInjectedValue } from "./desktop-api";

export const UI_VERSION = process.env.COMMIT_REF || "Unknown";

export const desktopVersion = lazyObservablePromise(async () => {
    return getDesktopInjectedValue('httpToolkitDesktopVersion');
    // Note that if we're running in a browser, not the desktop shell, this _never_ resolves.
});

export const serverVersion = lazyObservablePromise(() =>
    waitUntilServerReady().then(getServerVersion)
);

export const PORT_RANGE_SERVER_RANGE = '^0.1.14';