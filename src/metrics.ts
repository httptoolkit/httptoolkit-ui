import * as ReactGA from 'react-ga';
import { posthog } from 'posthog-js';

import { serverVersion, desktopVersion, UI_VERSION } from './services/service-versions';

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

        // dimension1 is version:server (so we can work out how many users have updated to which server version)
        serverVersion.then((version) => {
            ReactGA.set({ 'dimension1': version });
            posthog.people.set({ 'server-version': version });
        });

        // dimension2 is version:desktop (so we can work out how many users are using which desktop shell version)
        desktopVersion.then((version) => {
            ReactGA.set({ 'dimension2': version });
            posthog.people.set({ 'desktop-version': version });
        });

        // dimension3 is version:ui. We don't version the UI, so it's just the current commit hash
        ReactGA.set({ 'dimension3': UI_VERSION });
        posthog.people.set({ 'ui-version': UI_VERSION });

        ReactGA.timing({
            category: 'Initial load',
            variable: 'tracking-initialize',
            value: performance.now()
        });

        trackPage(window.location);

        window.addEventListener('DOMContentLoaded', () => {
            ReactGA.timing({
                category: 'Initial load',
                variable: 'page-load',
                value: performance.now()
            });
        });

        document.addEventListener('load:rendering', () => {
            ReactGA.timing({
                category: 'Initial load',
                variable: 'app-load',
                value: performance.now()
            });
        });

        window.addEventListener('load', () => {
            ReactGA.timing({
                category: 'Initial load',
                variable: 'load-event',
                value: performance.now()
            });
        });
    }
}

let lastUrl: string | undefined;
export function trackPage(location: Window['location']) {
    if (!enabled) return;

    const currentUrl = location.href
        .replace(/\/view\/[a-z0-9\-]+/, '/view') // Strip row ids
        .replace(/\/mock\/[a-z0-9\-]+/, '/mock') // Strip mock rule ids
        .replace(/\?.*/, ''); // Strip any query & hash params

    if (currentUrl === lastUrl) return;
    lastUrl = currentUrl;

    // That path is the part after the first slash, after the protocol:
    const currentPath = currentUrl.slice(currentUrl.indexOf('/', 'https://'.length));

    ReactGA.set({
        location: currentUrl,
        page: currentPath
    });
    ReactGA.pageview(currentPath);
    posthog.capture('$pageview', { $current_url: currentUrl });
}

export function trackEvent(event: ReactGA.EventArgs) {
    if (!enabled) return;

    ReactGA.event(event);
    posthog.capture(`${event.category}:${event.action}`, {
        value: event.label
    });
}