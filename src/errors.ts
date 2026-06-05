import * as Sentry from '@sentry/browser';

import { ApiError } from './services/server-api-types';

let sentryInitialized = false;

export { Sentry };

export function initSentry(
    dsn: string | undefined,
    tags: { [tag: string]: PromiseLike<string | undefined> } = {}
) {
    if (!dsn) return;

    Sentry.init({
        dsn: dsn,
        release: process.env.UI_VERSION || "Unknown",
        ignoreErrors: [
            'ResizeObserver loop limit exceeded', // No visible effect: https://stackoverflow.com/a/50387233/68051
            'ResizeObserver loop completed with undelivered notifications.'
        ],
        autoSessionTracking: false, // Don't send requests for every session (URL change)
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

    Object.entries(tags).forEach(([tag, valuePromise]) => {
        valuePromise.then(
            (value) => { if (value) addErrorTag(tag, value); },
            () => {} // Ignore failures - just don't add the tag
        );
    });

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
    const randomId = crypto.randomUUID();
    Sentry.getCurrentScope().setUser({
        id: randomId,
        username: `anon-${randomId}`
    });
}

export function logErrorsAsUser(id: string | undefined) {
    if (!sentryInitialized) return;

    if (!id) {
        Sentry.getCurrentScope().setUser(null);
    } else {
        // We track errors by user id - this ensures that any actual identities are
        // never exposed to Sentry (you need access to our user DB to link user error
        // reports and the corresponding Sentry data).
        id = id.replace('email|', '');
        Sentry.getCurrentScope().setUser({ id: id });
    }
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