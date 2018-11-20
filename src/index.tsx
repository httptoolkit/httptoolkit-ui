document.dispatchEvent(new Event('load:executing'));

import { ErrorBoundary, initSentry } from './components/error-boundary';
initSentry(process.env.SENTRY_DSN);

import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { GlobalStyles, ThemeProvider, lightTheme as theme } from './styles';
import { App } from './components/app';
import { Store } from './model/store';
import { Provider } from 'mobx-react';

import * as worker from './worker/worker-api';

const APP_ELEMENT_SELECTOR = '#app';

worker.send();

window.onload = async function startApp() {
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