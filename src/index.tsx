document.dispatchEvent(new Event('load:executing'));

import { ErrorBoundary, initSentry } from './components/error-boundary';
initSentry(process.env.SENTRY_DSN);

import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { GlobalStyles, ThemeProvider, lightTheme as theme } from './styles';
import { App } from './components/app';
import { Store } from './model/store';
import { Provider } from 'mobx-react';

import registerUpdateWorker, { ServiceWorkerNoSupportError } from 'service-worker-loader!./workers/update-worker';

const APP_ELEMENT_SELECTOR = '#app';

window.onload = async function startApp() {
    registerUpdateWorker({ scope: '/' })
    .then(() => console.log('Service worker loaded'))
    .catch((e) => {
        if (e instanceof ServiceWorkerNoSupportError) {
            console.log('Service worker not supported, oh well, no autoupdating for you.');
        }
        throw e;
    });

    const store = new Store();
    await store.startServer();

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
    , document.querySelector(APP_ELEMENT_SELECTOR));
}

if (module.hot) {
    module.hot.accept('.', function() {
        window.location.reload();
    })
}