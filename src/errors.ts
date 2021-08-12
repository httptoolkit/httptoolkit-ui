import * as Sentry from '@sentry/browser';

import { UI_VERSION, serverVersion, desktopVersion } from './services/service-versions';

let sentryInitialized = false;

export function isSentryInitialized() {
    return sentryInitialized;
}

export { Sentry };

export function initSentry(dsn: string | undefined) {
    if (dsn) {
        Sentry.init({
            dsn: dsn,
            release: UI_VERSION,
            ignoreErrors: [
                'ResizeObserver loop limit exceeded', // No visible effect: https://stackoverflow.com/a/50387233/68051
            ]
        });
        sentryInitialized = true;

        serverVersion.then((version) => addErrorTag('version:server', version));
        desktopVersion.then((version) => addErrorTag('version:desktop', version));

        // If we're running in the main window (not the SW),
        // stop reporting errors after the page starts unloading
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                Sentry.getCurrentHub().getClient().getOptions().enabled = false;
                sentryInitialized = false;
            });
        }
    }
}

export function reportErrorsAsUser(email: string | undefined) {
    if (!sentryInitialized) return;

    Sentry.configureScope((scope) => {
        scope.setUser({ email: email });
    });
}

function addErrorTag(key: string, value: string) {
    if (!sentryInitialized) return;

    Sentry.configureScope((scope) => {
        scope.setTag(key, value);
    });
}

export function reportError(error: Error | string, metadata: object = {}) {
    console.log('Reporting error:', error, metadata);
    if (!sentryInitialized) return;

    Sentry.withScope((scope) => {
        Object.entries(metadata).forEach(([key, value]) => {
            scope.setExtra(key, value);
        });

        if (typeof error === 'string') {
            Sentry.captureMessage(error);
        } else {
            Sentry.captureException(error);
        }
    });
}