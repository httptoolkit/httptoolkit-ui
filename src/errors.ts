import * as Sentry from '@sentry/browser';
import * as packageJson from '../package.json';

let sentryInitialized = false;

export function isSentryInitialized() {
    return sentryInitialized;
}

export { Sentry };

export function initSentry(dsn: string | undefined) {
    if (dsn) {
        Sentry.init({ dsn: dsn, release: packageJson.version });
        sentryInitialized = true;
    }
}

export function reportError(error: Error | string) {
    console.log('Reporting error:', error);
    if (typeof error === 'string') {
        Sentry.captureMessage(error);
    } else {
        Sentry.captureException(error);
    }
}