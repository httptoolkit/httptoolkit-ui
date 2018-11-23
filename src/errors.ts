
import * as Sentry from '@sentry/browser';
import * as packageJson from '../package.json';

let sentryInitialized = false;

export function isSentryInitialized() {
    return sentryInitialized;
}

export function initSentry(dsn: string | undefined) {
    if (dsn) {
        Sentry.init({ dsn: dsn, release: packageJson.version });
        sentryInitialized = true;
    }
}