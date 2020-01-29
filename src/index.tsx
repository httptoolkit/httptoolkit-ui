document.dispatchEvent(new Event('load:executing'));

import { initSentry, reportError } from './errors';
initSentry(process.env.SENTRY_DSN);

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { configure } from 'mobx';
import { Provider } from 'mobx-react';
import * as localForage from 'localforage';

import { GlobalStyles } from './styles';
import { delay } from './util/promise';
import { initTracking } from './tracking';
import { appHistory } from './routing';

import {
    scriptUrl as updateWorkerUrl,
    ServiceWorkerNoSupportError
} from 'service-worker-loader!./services/update-worker';

import { UiStore } from './model/ui-store';
import { AccountStore } from './model/account/account-store';
import { ServerStore } from './model/server-store';
import { EventsStore } from './model/http/events-store';
import { RulesStore } from './model/rules/rules-store';
import { InterceptorStore } from './model/interception/interceptor-store';
import { ApiStore } from './model/api/api-store';
import { triggerServerUpdate } from './services/server-api';

import { App } from './components/app';
import { StorePoweredThemeProvider } from './components/store-powered-theme-provider';
import { ErrorBoundary } from './components/error-boundary';
import { serverVersion } from './services/service-versions';

const APP_ELEMENT_SELECTOR = '#app';

function registerUpdateWorker(options: { scope: string }, authToken: string | null) {
    if ('serviceWorker' in navigator) {
        const params = authToken ? `?authToken=${authToken}` : '';
        return navigator.serviceWorker.register(updateWorkerUrl + params, options);
    }

    return Promise.reject(new ServiceWorkerNoSupportError());
}

const urlParams = new URLSearchParams(window.location.search);
const authToken = urlParams.get('authToken');

// Set up a SW in the background to add offline support & instant startup.
// This also checks for new versions after the first SW is already live.
// Delayed to avoid competing for bandwidth with startup on slow connections.
delay(10000).then(() =>
    registerUpdateWorker({ scope: '/' }, authToken)
).then((registration) => {
    console.log('Service worker loaded');

    // Check for SW updates every 5 minutes.
    setInterval(() => {
        triggerServerUpdate();
        registration.update().catch(console.log);
    }, 1000 * 60 * 5);
})
.catch((e) => {
    if (e instanceof ServiceWorkerNoSupportError) {
        console.log('Service worker not supported, oh well, no autoupdating for you.');
    }
    throw e;
});

initTracking();
const lastServerVersion = localStorage.getItem('last-server-version');
serverVersion.then((version) => localStorage.setItem('last-server-version', version));

configure({ enforceActions: 'observed' });
localForage.config({ name: "httptoolkit", version: 1 });

const accountStore = new AccountStore();
const apiStore = new ApiStore(accountStore);
const uiStore = new UiStore(accountStore);
const serverStore = new ServerStore(accountStore);
const eventsStore = new EventsStore(serverStore, apiStore);
const interceptorStore = new InterceptorStore(serverStore, accountStore);
const rulesStore = new RulesStore(
    accountStore,
    serverStore,
    eventsStore,
    (exchangeId: string) => appHistory.navigate(`/view/${exchangeId}`)
);

const stores = {
    accountStore,
    apiStore,
    uiStore,
    serverStore,
    eventsStore,
    interceptorStore,
    rulesStore
};

const appStartupPromise = Promise.all(
    Object.values(stores).map(store => store.initialized)
);

// Once the app is loaded, show the app
appStartupPromise.then(() => {
    // We now know that the server is running - tell it to check for updates
    triggerServerUpdate();

    console.log('App started, rendering');

    document.dispatchEvent(new Event('load:rendering'));
    ReactDOM.render(
        <Provider {...stores}>
            <StorePoweredThemeProvider>
                <ErrorBoundary>
                    <GlobalStyles />
                    <App />
                </ErrorBoundary>
            </StorePoweredThemeProvider>
        </Provider>
    , document.querySelector(APP_ELEMENT_SELECTOR))
});

const STARTUP_TIMEOUT = 10000;

// If loading fails, or we hit a timeout, show an error (but if we timeout,
// don't stop trying to load in the background anyway). If we do eventually
// succeed later on, the above render() will still happen and hide the error.
Promise.race([
    appStartupPromise,
    delay(STARTUP_TIMEOUT).then(() => {
        console.log('Previous server version was', lastServerVersion);

        throw Object.assign(
            new Error('Failed to initialize application'),
            { isTimeout: true }
        );
    })
]).catch((e) => {
    const failureEvent = Object.assign(
        new Event('load:failed'),
        { error: e }
    );
    document.dispatchEvent(failureEvent);
    reportError(e);

    appStartupPromise.then(() => {
        serverVersion.then((currentVersion) => {
            console.log('Server version was', lastServerVersion, 'now started late with', currentVersion);
            reportError('Successfully initialized application, but after timeout');
        });
    });
});