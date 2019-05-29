document.dispatchEvent(new Event('load:executing'));

import { initSentry, reportError } from './errors';
initSentry(process.env.SENTRY_DSN);

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'mobx-react';

import { GlobalStyles } from './styles';
import { delay } from './util';
import { initTracking } from './tracking';

import registerUpdateWorker, { ServiceWorkerNoSupportError } from 'service-worker-loader!./services/update-worker';

import { InterceptionStore } from './model/interception-store';
import { AccountStore } from './model/account/account-store';
import { triggerServerUpdate } from './services/server-api';
import { UiStore } from './model/ui-store';

import { App } from './components/app';
import { StorePoweredThemeProvider } from './components/store-powered-theme-provider';
import { ErrorBoundary } from './components/error-boundary';

const APP_ELEMENT_SELECTOR = '#app';

registerUpdateWorker({ scope: '/' })
.then((registration) => {
    console.log('Service worker loaded');

    // Check for SW updates every 5 minutes.
    setInterval(() => {
        // TODO: Reenable, once everybody has updated to a server that updates more reliably:
        // triggerServerUpdate();
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

const accountStore = new AccountStore();
const uiStore = new UiStore();
const interceptionStore = new InterceptionStore();

const appStartupPromise = Promise.all([
    interceptionStore.initialize(accountStore),
    uiStore.loadSettings()
]);

// Once the app is loaded, show the app
appStartupPromise.then(() => {
    // We now know that the server is running - tell it to check for updates
    triggerServerUpdate();

    document.dispatchEvent(new Event('load:rendering'));
    ReactDOM.render(
        <Provider interceptionStore={interceptionStore} accountStore={accountStore} uiStore={uiStore}>
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
    delay(STARTUP_TIMEOUT).then(() => { throw new Error('Failed to initialize application'); })
]).catch((e) => {
    document.dispatchEvent(new Event('load:failed'));
    reportError(e);

    appStartupPromise.then(() => {
        reportError('Successfully initialized application, but after timeout')
    });
});