import * as Sentry from '@sentry/browser';
import * as uuid from 'uuid/v4';

import { UI_VERSION, serverVersion, desktopVersion } from './services/service-versions';
import { ApiError } from './services/server-api-types';

let sentryInitialized = false;

export function isSentryInitialized() {
    return sentryInitialized;
}

export { Sentry };

export function initSentry(dsn: string | undefined) {
    if (!dsn) return;

    Sentry.init({
        dsn: dsn,
        release: UI_VERSION,
        ignoreErrors: [
            'ResizeObserver loop limit exceeded', // No visible effect: https://stackoverflow.com/a/50387233/68051
        ],
        beforeSend: function (event, hint) {
            const exception = hint?.originalException;
            if (exception instanceof ApiError) {
                event.fingerprint = [
                    "{{ default }}",
                    exception.operationName,
                    ...(exception.errorCode
                        ? [exception.errorCode.toString()]
                        : []
                    )
                ];
            }
            return event;
        }
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

    Sentry.configureScope((scope) => {
        // We use a random id to distinguish between many errors in one session vs
        // one error in many sessions. This isn't persisted and can't be used to
        // identify anybody between sessions.
        const randomId = uuid();
        scope.setUser({
            id: randomId,
            username: `anon-${randomId}`
        });
    });
}

export function logErrorsAsUser(email: string | undefined) {
    if (!sentryInitialized) return;

    Sentry.configureScope((scope) => {
        scope.setUser({
            id: email,
            email: email
        });
    });
}

function addErrorTag(key: string, value: string) {
    if (!sentryInitialized) return;

    Sentry.configureScope((scope) => {
        scope.setTag(key, value);
    });
}

export function logError(error: Error | string | unknown, metadata: object = {}) {
    console.log('Reporting error:', error, metadata);
    if (!sentryInitialized) return;

    Sentry.withScope((scope) => {
        Object.entries(metadata).forEach(([key, value]) => {
            scope.setExtra(key, value);
        });

        if (typeof error === 'string') {
            Sentry.captureMessage(error);
        } else if (error instanceof Error) {
            Sentry.captureException(error);
        } else {
            console.warn('Reporting non-error', error);
            Sentry.captureMessage(`Non-error thrown: ${error}`);
        }
    });
}