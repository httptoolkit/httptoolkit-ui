document.dispatchEvent(new Event('load:executing'));

import { initSentry, reportError } from './errors';
initSentry(process.env.SENTRY_DSN);

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'mobx-react';

import { GlobalStyles, ThemeProvider, lightTheme as theme } from './styles';
import { App } from './components/app';
import { ErrorBoundary } from './components/error-boundary';
import { InterceptionStore } from './model/interception-store';
import { AccountStore } from './model/account-store';
import { triggerServerUpdate } from './model/htk-client';
import { initTracking } from './tracking';

import registerUpdateWorker, { ServiceWorkerNoSupportError } from 'service-worker-loader!./workers/update-worker';

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
const interceptionStore = new InterceptionStore();
interceptionStore.startServer().then(() => {
    // We now know that the server is running - tell it to check for updates
    triggerServerUpdate();

    document.dispatchEvent(new Event('load:rendering'));
    ReactDOM.render(
        <Provider interceptionStore={interceptionStore} accountStore={accountStore}>
            <ThemeProvider theme={theme}>
                <ErrorBoundary>
                    <GlobalStyles />
                    <App />
                </ErrorBoundary>
            </ThemeProvider>
        </Provider>
    , document.querySelector(APP_ELEMENT_SELECTOR))
}).catch((e) => {
    document.dispatchEvent(new Event('load:failed'));
    console.error('Failed to initialize application.', e);
    reportError(e);
});