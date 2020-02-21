import * as _ from 'lodash';
import * as querystring from 'querystring';
import { createHistory, WindowLocation, NavigateOptions } from "@reach/router";

// Whatever params we're given at the initial load, we want to save & preserve
// them, so they persist across all future navigations.
const INITIAL_PARAMS = querystring.parse(
    window.location.search.replace(/^\?/, '')
);

// Builds a history source backed by the real browser history API, but throttling
// updates to that API, and covering that up by also tracking the current location
// in memory on top.
const buildThrottledHistorySource = () => {
    let latestState = window.history.state;
    let latestLocation = window.location;

    window.addEventListener('popstate', () => {
        latestState = window.history.state;
        latestLocation = window.location;
    });

    // Throttle the state update calls - this is important because Chrome will complain &
    // rate limit calls if we go too fast, and we can at times (when scrolling events).
    const throttledPushState = _.throttle(
        (...args: any) => window.history.pushState.apply(window.history, args),
        250,
        { leading: true, trailing: true }
    );
    const throttledReplaceState = _.throttle(
        (...args: any) => window.history.replaceState.apply(window.history, args),
        250,
        { leading: true, trailing: true }
    );

    return {
        get location() {
            return latestLocation as WindowLocation;
        },
        addEventListener: window.addEventListener.bind(window),
        removeEventListener: window.removeEventListener.bind(window),
        history: {
            get state() {
                return latestState;
            },
            pushState(state: any, title: string, uri: string) {
                throttledPushState(state, title, uri);
                let [pathname, search = ""] = uri.split("?");
                latestLocation = Object.assign({}, window.location, { pathname, search });
            },
            replaceState(state: any, title: string, uri: string) {
                throttledReplaceState(state, title, uri);
                let [pathname, search = ""] = uri.split("?");
                latestLocation = Object.assign({}, window.location, { pathname, search });
            }
        }
    };
};

// Throttlesafe: even with Chrome's throttling us, it'll still work nicely.
export const appHistory = createHistory(buildThrottledHistorySource());

// Wrap navigate(), to always preserve our query params:
const navigate = appHistory.navigate.bind(appHistory);
appHistory.navigate = function (to: string, options: NavigateOptions<{}> = {}) {
    const [pathString, searchString] = to.split("?");
    const params = querystring.parse(searchString);

    return navigate(pathString + "?" + querystring.stringify({
        ...params,
        ...INITIAL_PARAMS
    }), options);
};