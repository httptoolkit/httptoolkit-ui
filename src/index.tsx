document.dispatchEvent(new Event('load:executing'));

import { initSentry, reportError } from './errors';
initSentry(process.env.SENTRY_DSN);

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'mobx-react';

import { GlobalStyles, ThemeProvider, darkTheme as theme, initStyles } from './styles';
import { App } from './components/app';
import { ErrorBoundary } from './components/error-boundary';
import { InterceptionStore } from './model/interception-store';
import { AccountStore } from './model/account/account-store';
import { triggerServerUpdate } from './model/htk-client';
import { initTracking } from './tracking';

import registerUpdateWorker, { ServiceWorkerNoSupportError } from 'service-worker-loader!./workers/update-worker';

import { delay } from './util';

const APP_ELEMENT_SELECTOR = '#app';

if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist()
    .then((persisted) => {
        console.log(persisted ? 'Could not persist storage' : 'Storage is persisted');
    })
    .catch((e) => reportError(e));
}

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
const interceptionStore = new InterceptionStore();

const appStartupPromise = interceptionStore.startServer();

// Once the app is loaded, show the app
appStartupPromise.then(() => {
    // We now know that the server is running - tell it to check for updates
    triggerServerUpdate();

    document.dispatchEvent(new Event('load:rendering'));
    initStyles(theme);
    ReactDOM.render(
        <Provider interceptionStore={interceptionStore} accountStore={accountStore} theme={theme}>
            <ThemeProvider theme={theme}>
                <ErrorBoundary>
                    <GlobalStyles />
                    <App />
                </ErrorBoundary>
            </ThemeProvider>
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