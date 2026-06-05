import * as localForage from 'localforage';
import * as semver from 'semver';

// These version utilities have no dependency on the server (or desktop) APIs, so they're
// safe to use from the update service worker, which can't reach those. The rest of the
// version logic (notably the live server version probe) lives in ./service-versions.

// The last known server version - immediately available (though still async), but reports
// the previous startup version, not necessarily the latest one. May be undefined if the
// app has never yet started successfully.
export const lastServerVersion = localForage.getItem<string>('last-server-version');

export function versionSatisfies(version: string | Error | undefined, range: string) {
    return (typeof version === 'string') &&
        semver.satisfies(version, range, { includePrerelease: true });
}
