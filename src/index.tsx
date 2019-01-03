document.dispatchEvent(new Event('load:executing'));

import { initSentry, reportError } from './errors';
initSentry(process.env.SENTRY_DSN);

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'mobx-react';

import { GlobalStyles, ThemeProvider, lightTheme as theme } from './styles';
import { App } from './components/app';
import { ErrorBoundary } from './components/error-boundary';
import { Store } from './model/store';
import { initTracking } from './tracking';

import registerUpdateWorker, { ServiceWorkerNoSupportError } from 'service-worker-loader!./workers/update-worker';

const APP_ELEMENT_SELECTOR = '#app';

registerUpdateWorker({ scope: '/' })
.then(() => console.log('Service worker loaded'))
.catch((e) => {
    if (e instanceof ServiceWorkerNoSupportError) {
        console.log('Service worker not supported, oh well, no autoupdating for you.');
    }
    throw e;
});

initTracking();

const store = new Store();
store.startServer().then(() => {
    document.dispatchEvent(new Event('load:rendering'));
    ReactDOM.render(
        <Provider store={store}>
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