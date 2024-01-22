import { triggerServerUpdate } from './server-api';

import packageMetadata from '../../package.json';
import { desktopVersion, serverVersion, versionSatisfies } from './service-versions';

export const attemptServerUpdate = () =>
    triggerServerUpdate().catch(console.warn);

// Set up a SW in the background, to add offline support & instant startup.
// This also checks for new UI & server versions at intervals.
export async function runBackgroundUpdates() {
    // Set in dev to avoid update noise etc:
    if (process.env.DISABLE_UPDATES) return;

    // Try to trigger a server update. Can't guarantee it'll work, and we also trigger it
    // after successful startup, but this tries to ensure that even if startup is broken,
    // we still update the server (and hopefully thereby unbreak app startup).
    attemptServerUpdate();

    try {
        if (!navigator?.serviceWorker?.register) {
            console.warn('Service worker not supported - cached & offline startup will not be available');
            return;
        }

        const registration = await navigator.serviceWorker.register(
            '/ui-update-worker.js',
            { scope: '/' }
        );

        console.log('Service worker loaded');
        registration.update().catch(console.log);

        // Check for server & UI updates every 5 minutes:
        setInterval(() => {
            attemptServerUpdate();
            registration.update().catch(console.log);
        }, 1000 * 60 * 5);
    } catch (e) {
        throw e;
    }
}

function showPleaseUpdateMessage() {
    alert(
        "This HTTP Toolkit installation is now very outdated, and this version is " +
        "no longer supported." +
        "\n\n" +
        "You can continue to use HTTP Toolkit, but you may experience issues & " +
        "instability." +
        "\n\n" +
        "Please update to the latest version from httptoolkit.com when you can, " +
        "to access the many new features, bug fixes & performance improvements " +
        "available there."
    );
}

export function checkForOutdatedComponents() {
    const { runtimeDependencies } = packageMetadata;

    let hasShownUpdateMessage = false;

    serverVersion.then((serverVersion) => {
        if (versionSatisfies(serverVersion, runtimeDependencies['httptoolkit-server'])) return;
        if (hasShownUpdateMessage) return;

        // This one should be _very_ rare, since the server always auto-updates - it'll only
        // affect systems where that is failing for some reason, for years.

        showPleaseUpdateMessage();
        hasShownUpdateMessage = true;
    }).catch(() => {});

    desktopVersion.then((desktopVersion) => {
        if (versionSatisfies(desktopVersion, runtimeDependencies['httptoolkit-desktop'])) return;
        if (hasShownUpdateMessage) return;

        // This will trigger for a few users, but not many - below 0.2% of weekly users right now

        showPleaseUpdateMessage();
        hasShownUpdateMessage = true;
    }).catch(() => {});
}