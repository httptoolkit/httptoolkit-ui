import * as localForage from 'localforage';
import * as semver from 'semver';

import { RUNNING_IN_WORKER } from '../util';
import { lazyObservablePromise } from "../util/observable";
import { getServerVersion, waitUntilServerReady } from "./server-api";
import { getDesktopInjectedValue } from "./desktop-api";

export const UI_VERSION = process.env.UI_VERSION || "Unknown";

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

export function versionSatisfies(version: string | Error | undefined, range: string) {
    return (typeof version === 'string') &&
        semver.satisfies(version, range, { includePrerelease: true });
}

// A quick way to check server support synchronously
export function serverSupports(versionRequirement: string | undefined) {
    if (!versionRequirement || versionRequirement === '*') return true;

    // If we haven't got the server version yet, assume anything specific is unsupported
    if (serverVersion.state !== 'fulfilled') return false;

    const version = serverVersion.value as string; // Fulfilled -> string value
    return versionSatisfies(version, versionRequirement);
}

// Notable desktop versions:
export const DESKTOP_HEADER_LIMIT_CONFIGURABLE = "^0.1.20 || ^1.0.0";
export const DESKTOP_SELECT_SAVE_FILE_SUPPORTED = "^1.23.0";

// Notable server versions:
export const PORT_RANGE_SERVER_RANGE = '^0.1.14 || ^1.0.0';
export const MODIFY_RULE_SERVER_RANGE = '^0.1.21 || ^1.0.0';
export const HOST_MATCHER_SERVER_RANGE = '^0.1.22 || ^1.0.0';
export const CLIENT_CERT_SERVER_RANGE = '^0.1.26 || ^1.0.0';
export const FROM_FILE_HANDLER_SERVER_RANGE = '^0.1.28 || ^1.0.0';
export const DETAILED_CONFIG_RANGE = '^0.1.30 || ^1.0.0';
export const INTERCEPTOR_METADATA = '^0.1.31 || ^1.0.0';
export const INITIAL_HTTP2_RANGE = '^0.1.44 || ^1.0.0';
export const BODY_MATCHING_RANGE = '^1.1.4';
export const WEBSOCKET_RULE_RANGE = '^1.1.3';
export const DETAILED_METADATA = '^1.2.0';
export const PASSTHROUGH_TRANSFORMS_RANGE = '^1.4.0';
export const PROXY_CONFIG_RANGE = '^1.4.1';
export const CLOSE_IN_BREAKPOINT = '^1.4.2';
export const DNS_AND_RULE_PARAM_CONFIG_RANGE = '^1.5.0';
export const DOCKER_INTERCEPTION_RANGE = '^1.5.0';
export const CUSTOM_CA_TRUST_RANGE = '^1.7.0';
export const MULTIPLE_EXISTING_TERMINAL_RANGE = '^1.8.0';
export const RAW_BODY_SUPPORTED = '^1.9.0';
export const WEBSOCKET_MESSAGING_RULES_SUPPORTED = '^1.9.0';
export const WEBRTC_GLOBALLY_ENABLED = '^1.10.3';
export const JSONRPC_RESPONSE_RULE_SUPPORTED = '^1.11.0';
export const RTC_RULES_SUPPORTED = '^1.11.0';
export const TLS_PASSTHROUGH_SUPPORTED = '^1.12.0';
export const CONNECTION_RESET_SUPPORTED = '^1.12.0';
export const SERVER_REST_API_SUPPORTED = '^1.13.0';
export const SERVER_SEND_API_SUPPORTED = '^1.13.0';
export const ADVANCED_PATCH_TRANSFORMS = '^1.18.0';
export const WILDCARD_CLIENT_CERTS = '^1.22.0';
export const KEY_LOG_FILE_SUPPORTED = '^1.23.0';
export const WEBHOOK_AND_DELAY_RULES = '^1.23.0';