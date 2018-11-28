import * as ReactGA from 'react-ga';

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

        const { timing } = window.performance;

        ReactGA.timing({
            category: 'Initial load',
            variable: 'page-load',
            value: timing.loadEventEnd - timing.navigationStart
        });

        ReactGA.timing({
            category: 'Initial load',
            variable: 'dom-render',
            value: timing.domComplete - timing.domLoading
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