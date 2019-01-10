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