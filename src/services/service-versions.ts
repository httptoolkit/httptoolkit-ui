import * as localForage from 'localforage';

import { RUNNING_IN_WORKER } from '../util';
import { lazyObservablePromise } from "../util/observable";
import { getServerVersion, waitUntilServerReady } from "./server-api";
import { getDesktopInjectedValue } from "./desktop-api";

export const UI_VERSION = process.env.COMMIT_REF || "Unknown";

export const desktopVersion = lazyObservablePromise(async () => {
    return getDesktopInjectedValue('httpToolkitDesktopVersion');
    // Note that if we're running in a browser, not the desktop shell, this _never_ resolves.
});

// The current server version, directly checked against the running
// server, not available until it starts up.
export const serverVersion = lazyObservablePromise(() =>
    waitUntilServerReady()
        .then(getServerVersion)
        .then((version) => {
            localForage.setItem('last-server-version', version);
            return version;
        })
);

// Notable desktop versions:
export const DESKTOP_HEADER_LIMIT_CONFIGURABLE = "^0.1.20";

// The last known service version - immediately available (though still async),
// but reports the previous startup version, not necessarily the latest one.
// May be undefined if the app has never yet started successfully.
export const lastServerVersion =
    localForage.getItem<string>('last-server-version')
    // Fallback to previous localStorage data approach, just in case
    .then((version) => {
        if (!version && !RUNNING_IN_WORKER) {
            return localStorage.getItem('last-server-version')
        }
        else return version;
    });

// Notable server versions:
export const PORT_RANGE_SERVER_RANGE = '^0.1.14';
export const MOCK_SERVER_RANGE = '^0.1.21';
export const HOST_MATCHER_SERVER_RANGE = '^0.1.22';
export const CLIENT_CERT_SERVER_RANGE = '^0.1.26';
export const FROM_FILE_HANDLER_SERVER_RANGE = '^0.1.28';
export const DETAILED_CONFIG_RANGE = '^0.1.30';
export const INTERCEPTOR_METADATA = '^0.1.31';
export const INITIAL_HTTP2_RANGE = '^0.1.44';