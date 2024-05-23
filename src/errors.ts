import * as Sentry from '@sentry/browser';
import * as uuid from 'uuid/v4';

import { UI_VERSION, serverVersion, desktopVersion } from './services/service-versions';
import { ApiError } from './services/server-api-types';

let sentryInitialized = false;

export { Sentry };

export function initSentry(dsn: string | undefined) {
    if (!dsn) return;

    Sentry.init({
        dsn: dsn,
        release: UI_VERSION,
        ignoreErrors: [
            'ResizeObserver loop limit exceeded', // No visible effect: https://stackoverflow.com/a/50387233/68051
            'ResizeObserver loop completed with undelivered notifications.'
        ],
        integrations: [
            Sentry.dedupeIntegration(),
            Sentry.extraErrorDataIntegration(),
            Sentry.httpClientIntegration()
        ],
        beforeSend: function (event, hint) {
            if (!sentryInitialized) return null; // Don't send errors if we're disabled

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
            // This is checked in beforeSend, and used to skip error reporting
            sentryInitialized = false;
        });
    }

    // We use a random id to distinguish between many errors in one session vs
    // one error in many sessions. This isn't persisted and can't be used to
    // identify anybody between sessions.
    const randomId = uuid();
    Sentry.getCurrentScope().setUser({
        id: randomId,
        username: `anon-${randomId}`
    });
}

export function logErrorsAsUser(email: string | undefined) {
    if (!sentryInitialized) return;

    Sentry.getCurrentScope().setUser({
        id: email,
        email: email
    });
}

function addErrorTag(key: string, value: string) {
    if (!sentryInitialized) return;

    Sentry.getCurrentScope().setTag(key, value);
}

export function logError(error: Error | string | unknown, metadata: { [key: string]: any } = {}) {
    console.log('Reporting error:', error, metadata);
    if (!sentryInitialized) return;

    Sentry.withScope((scope) => {
        scope.setExtras(metadata);

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