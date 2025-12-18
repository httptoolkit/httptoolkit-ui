import { posthog } from 'posthog-js';
import { format as formatDate } from 'date-fns';

import { serverVersion, desktopVersion, UI_VERSION } from './services/service-versions';
import { delay } from './util/promise';
import { DesktopApi } from './services/desktop-api';

const POSTHOG_KEY = process.env.POSTHOG_KEY;
const enabled = !!POSTHOG_KEY && navigator.doNotTrack !== "1";

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
        posthog.init(POSTHOG_KEY, {
            api_host: 'https://events.httptoolkit.tech',
            autocapture: false, // No automatic event capture please

            capture_pageview: false, // We manually capture pageviews (to sanitize & dedupe URLs)

            advanced_disable_decide: true, // We don't need dynamic features, skip checking
            disable_session_recording: true, // Disabled server-side, but disable explicitly here too

            persistence: 'memory' // No cookies/local storage tracking - just anon session metrics
        });

        // We capture just a single pageview to count overall user numbers - no point logging
        // every single page separately, who cares. Try to wait for initialization first though,
        // so we can see the server version etc. We might not track <10s sessions - again who cares.
        Promise.race([
            Promise.all([
                DesktopApi.waitUntilDesktopApiReady?.(),
                serverVersion
            ]),
            delay(10_000)
        ]).then(() => {
            posthog.capture('$pageview', {
                $current_url: window.origin,
                $set_once: { ...sessionData() }
            });
        });
    }
}

// Log the first run date for users, which gives us just enough data to count new vs existing installs, and overall
// retention (do people keep using the tool) and user stats, but at day resolution so it's not actually identifiable:
const today = formatDate(new Date(), 'YYYY-MM-DD');
const isFirstRun = localStorage.getItem('first-run-date') === null &&
    localStorage.getItem('theme-background-color') === null; // Extra check, for people who pre-date first-run-date

const storedFirstRunDate = localStorage.getItem('first-run-date');
const firstRunDate = storedFirstRunDate ?? today;
if (!storedFirstRunDate) {
    localStorage.setItem('first-run-date', firstRunDate);
}

// Track last run too, which gives us some idea of how many users use HTTP Toolkit per day.
const isFirstRunToday = localStorage.getItem('last-run-date') !== today;
if (isFirstRunToday) localStorage.setItem('last-run-date', today);

// (Of course, Posthog does have retention tools to track this kind of thing in depth, but we avoid using them here
// as they require tracking individual users & storing persistent ids etc - rough & anon is good enough).

// This is passed via $set_once on all Posthog events, and the session collects metadata once it's
// available. These values never change as all metrics are anonymous - there's no connection between
// sessions, so the desktop/server version is always fixed.
const sessionData = () => {
    const desktopDetails = DesktopApi.getDeviceInfo?.();

    // We collect some data here, but we do our best to make sure it's anonymous and we couldn't
    // track users by the data here even if we wanted to. We're looking for very general patterns
    // (there's still lots of Windows 10 users, most Mac users are on ARM now) and we don't want
    // any particularly unique values in here.

    return {
        // These are booleans - not dates, just used to work out a rough daily new/existing user count.
        'first-run': isFirstRun,
        'first-run-today': isFirstRunToday,

        // Current app versions - not a fingerprinting vector since they change very frequently and
        // in concert across the whole userbase.
        'ui-version': UI_VERSION,
        'server-version': serverVersion.state === 'fulfilled' ? serverVersion.value : undefined,
        'desktop-version': desktopVersion.state === 'fulfilled' ? desktopVersion.value : undefined,

        // Various platform details we use to judge which platforms to support/drop. These should
        // not be a significant fingerprinting vector - there's relatively few values in practice,
        // and we actively simplify them (to drop patch versions etc) in the desktop app.
        'platform': desktopDetails?.platform, // E.g. Windows
        'platform-release': desktopDetails?.release, // E.g. Windows 10
        'runtime-arch': desktopDetails?.runtimeArch, // E.g. x64
        'real-arch': desktopDetails?.realArch // E.g. actually ARM64 (on Mac with Rosetta)
    };
};

const normalizeUrl = (url: string) =>
    url
    .replace(/\/view\/[a-z0-9\-]+/, '/view') // Strip row ids
    .replace(/\/modify\/[a-z0-9\-]+/, '/modify') // Strip modify rule ids
    .replace(/\?.*/, ''); // Strip any query & hash params

const seenLimitedEvents = new Set<string>();

export function trackEvent(event: {
    category: string,
    action: string,
    value?: string
}) {
    if (!enabled) return;

    // For each specific event, we only want to log it once per session. We want an outline of
    // usage (which features are popular) not a detailed log of everything that happens.
    const eventKey = `${event.category}${event.action}${event.value}`;
    if (seenLimitedEvents.has(eventKey)) return;
    seenLimitedEvents.add(eventKey);

    const currentUrl = normalizeUrl(location.href);

    posthog.capture(`${event.category}:${event.action}`, {
        value: event.value,
        $current_url: currentUrl,
        $set_once: { ...sessionData() }
    });
}