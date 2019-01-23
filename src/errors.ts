import * as Sentry from '@sentry/browser';
import * as packageJson from '../package.json';

import { getDesktopShellVersion } from './tracking';
import { getVersion as getServerVersion } from './model/htk-client';

let sentryInitialized = false;

export function isSentryInitialized() {
    return sentryInitialized;
}

export { Sentry };

export function initSentry(dsn: string | undefined) {
    if (dsn) {
        Sentry.init({ dsn: dsn, release: packageJson.version });

        getServerVersion().then((version) =>
            Sentry.configureScope((scope) => scope.setExtra('version:server', version))
        );

        getDesktopShellVersion().then((version) =>
            Sentry.configureScope((scope) => scope.setExtra('version:desktop', version))
        );

        sentryInitialized = true;

        // If we're running in the main window (not the SW),
        // stop reporting errors after the page starts unloading
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                sentryInitialized = false;
            });
        }
    }
}

export function reportError(error: Error | string) {
    console.log('Reporting error:', error);
    if (!sentryInitialized) return;

    if (typeof error === 'string') {
        Sentry.captureMessage(error);
    } else {
        Sentry.captureException(error);
    }
}