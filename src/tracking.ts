import * as ReactGA from 'react-ga';
import { waitUntilServerReady, getVersion as getServerVersion } from './model/htk-client';

const GA_ID = process.env.GA_ID;

// Note that all tracking here is fully anonymous.
// No user information is tracked, and no events are
// sent including anything personally identifiable.
// Tracking is used only to monitor real world performance,
// and work out which features of the app are used
// and how much.

export function initTracking() {
    if (GA_ID) {
        ReactGA.initialize(GA_ID, { gaOptions: { siteSpeedSampleRate: 100 } });

        // dimension1 is version:server (so we can work out how many users have updated to which server version)
        waitUntilServerReady().then(async () => {
            const version = await getServerVersion();
            ReactGA.set({ 'dimension1': version })
        });

        // dimension2 is version:desktop (so we can work out how many users are using which desktop shell version)
        getDesktopShellVersion().then((version) => ReactGA.set({ 'dimension2': version }));

        // dimension3 is version:ui. We don't version the UI, so it's just the current commit hash
        ReactGA.set({ 'dimension3': process.env.COMMIT_REF });

        ReactGA.timing({
            category: 'Initial load',
            variable: 'tracking-initialize',
            value: performance.now()
        });

        ReactGA.pageview('initial');

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

export function trackPage(page: string) {
    if (!GA_ID) return;
    ReactGA.pageview(page);
}

export function trackEvent(event: ReactGA.EventArgs) {
    if (!GA_ID) return;
    ReactGA.event(event);
}

declare global {
    // Injected by the desktop shell, if we're using in it (rather than a normal browser)
    interface Window { httpToolkitDesktopVersion: string | undefined; }
}
export async function getDesktopShellVersion() {
    // In the SW, it's tricky to check the desktop version, as we don't get it injected.
    // For now, just treat it as a different environment
    if (typeof window === 'undefined') return 'service-worker';

    if (window.httpToolkitDesktopVersion) {
        // If it's already been set, just return it
        return window.httpToolkitDesktopVersion;
    } else {
        return new Promise((resolve) => {
            // If not, it might still be coming (there's race here), so listen out
            window.addEventListener('message', (message) => {
                if (message.data.httpToolkitDesktopVersion) {
                    resolve(message.data.httpToolkitDesktopVersion);
                }
            });
        });
    }
    // Note that if we're running in a browser, not the desktop shell, this _never_ resolves.
}