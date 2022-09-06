document.dispatchEvent(new Event('load:executing'));

import * as localForage from 'localforage';
localForage.config({ name: "httptoolkit", version: 1 });

const urlParams = new URLSearchParams(window.location.search);
const authToken = urlParams.get('authToken');
localForage.setItem('latest-auth-token', authToken);

import { initSentry, reportError } from './errors';
initSentry(process.env.SENTRY_DSN);

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as mobx from 'mobx';
import { Provider } from 'mobx-react';

import { GlobalStyles } from './styles';
import { delay } from './util/promise';
import { initTracking } from './tracking';
import { appHistory } from './routing';

import registerUpdateWorker, { ServiceWorkerNoSupportError } from 'service-worker-loader!./services/update-worker';

import { UiStore } from './model/ui-store';
import { AccountStore } from './model/account/account-store';
import { ProxyStore } from './model/proxy-store';
import { EventsStore } from './model/events/events-store';
import { RulesStore } from './model/rules/rules-store';
import { InterceptorStore } from './model/interception/interceptor-store';
import { ApiStore } from './model/api/api-store';
import { triggerServerUpdate } from './services/server-api';

import { App } from './components/app';
import { StorePoweredThemeProvider } from './components/store-powered-theme-provider';
import { ErrorBoundary } from './components/error-boundary';
import { serverVersion, lastServerVersion, UI_VERSION } from './services/service-versions';

console.log(`Initialising UI (version ${UI_VERSION})`);

const APP_ELEMENT_SELECTOR = '#app';

mobx.configure({ enforceActions: 'observed' });

// Set up a SW in the background to add offline support & instant startup.
// This also checks for new versions after the first SW is already live.
// Slightly delayed to avoid competing for bandwidth with startup on slow connections.
delay(5000).then(() => {
    // Try to trigger a server update. Can't guarantee it'll work, and we also trigger
    // after successful startup, but this tries to ensure that even if startup is broken,
    // we still update the server (and hopefully thereby unbreak app startup).
    triggerServerUpdate();
    return registerUpdateWorker({ scope: '/' });
}).then((registration) => {
    console.log('Service worker loaded');
    registration.update().catch(console.log);

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

const accountStore = new AccountStore(
    () => appHistory.navigate('/settings')
);
const apiStore = new ApiStore(accountStore);
const uiStore = new UiStore(accountStore);
const proxyStore = new ProxyStore(accountStore);
const eventsStore = new EventsStore(proxyStore, apiStore);
const interceptorStore = new InterceptorStore(proxyStore, accountStore);
const rulesStore = new RulesStore(
    accountStore,
    proxyStore,
    eventsStore,
    (exchangeId: string) => appHistory.navigate(`/view/${exchangeId}`)
);

const stores = {
    accountStore,
    apiStore,
    uiStore,
    proxyStore,
    eventsStore,
    interceptorStore,
    rulesStore
};

const appStartupPromise = Promise.all(
    Object.values(stores).map(store => store.initialized)
);
initTracking();

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
    delay(STARTUP_TIMEOUT).then(async () => {
        console.log('Previous server version was', await lastServerVersion);

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
        serverVersion.then(async (currentVersion) => {
            console.log('Server version was', await lastServerVersion, 'now started late with', currentVersion);
            reportError('Successfully initialized application, but after timeout');
        });
    });
});