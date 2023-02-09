import * as ReactGA from 'react-ga';
import { posthog } from 'posthog-js';

import { serverVersion, desktopVersion, UI_VERSION } from './services/service-versions';
import { observablePromise } from './util/observable';
import { delay } from './util/promise';

const GA_ID = process.env.GA_ID;
const POSTHOG_KEY = process.env.POSTHOG_KEY;
const enabled = !!GA_ID && !!POSTHOG_KEY && navigator.doNotTrack !== "1";

// Note that all metrics here are fully anonymous.
// No user information is tracked, no events are
// sent including anything personally identifiable,
// and all Posthog data (soon: all data) is sent
// via an anonymizing proxy so no IP is exposed.

// Metrics are used only to monitor real world
// performance, work out which features of the app
// are used, and detect issues (e.g. % failure for
// different types of interception).

export function initMetrics() {
    if (enabled) {
        ReactGA.initialize(GA_ID!, {
            gaOptions: {
                siteSpeedSampleRate: 100
            }
        });

        posthog.init(POSTHOG_KEY, {
            api_host: 'https://events.httptoolkit.tech',
            autocapture: false, // No automatic event capture please

            capture_pageview: false, // We manually capture pageview (to sanitize & dedupe URLs)

            advanced_disable_decide: true, // We don't need dynamic features, skip checking
            disable_session_recording: false, // Disabled server-side, but disable explicitly here too

            persistence: 'memory' // No cookies/local storage tracking - just anon session metrics
        });

        ReactGA.set({ anonymizeIp: true });

        // GA metadata needs to be handled separately here:
        serverVersion.then((version) => ReactGA.set({ 'dimension1': version }));
        desktopVersion.then((version) => ReactGA.set({ 'dimension2': version }));
        ReactGA.set({ 'dimension3': UI_VERSION });

        trackPage(window.location);
    }
}

const normalizeUrl = (url: string) =>
    url
    .replace(/\/view\/[a-z0-9\-]+/, '/view') // Strip row ids
    .replace(/\/mock\/[a-z0-9\-]+/, '/mock') // Strip mock rule ids
    .replace(/\?.*/, ''); // Strip any query & hash params

// This is passed via $set_once on all Posthog events, and the session collects metadata once it's
// available. These values never change as all metrics are anonymous - there's no connection between
// sessions, so the desktop/server version is always fixed.
const sessionData = () => ({
    'ui-version': UI_VERSION,
    'server-version': serverVersion.state === 'fulfilled' ? serverVersion.value : undefined,
    'desktop-version': desktopVersion.state === 'fulfilled' ? desktopVersion.value : undefined,
});

let lastUrl: string | undefined;
export function trackPage(location: Window['location']) {
    if (!enabled) return;

    const currentUrl = normalizeUrl(location.href);

    if (currentUrl === lastUrl) return;
    lastUrl = currentUrl;

    // That path is the part after the first slash, after the protocol:
    const currentPath = currentUrl.slice(currentUrl.indexOf('/', 'https://'.length));

    ReactGA.set({
        location: currentUrl,
        page: currentPath
    });
    ReactGA.pageview(currentPath);
    posthog.capture('$pageview', {
        $current_url: currentUrl,
        $set_once: { ...sessionData() }
    });
}

export function trackEvent(event: ReactGA.EventArgs) {
    if (!enabled) return;

    const currentUrl = normalizeUrl(location.href);

    ReactGA.event(event);
    posthog.capture(`${event.category}:${event.action}`, {
        value: event.label,
        $current_url: currentUrl,
        $set_once: { ...sessionData() }
    });
}