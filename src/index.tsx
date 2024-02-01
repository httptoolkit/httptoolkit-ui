document.dispatchEvent(new Event('load:executing'));

import * as localForage from 'localforage';
localForage.config({ name: "httptoolkit", version: 1 });

const urlParams = new URLSearchParams(window.location.search);
const authToken = urlParams.get('authToken');
localForage.setItem('latest-auth-token', authToken);

import { initSentry, logError } from './errors';
initSentry(process.env.SENTRY_DSN);

import * as _ from 'lodash';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as mobx from 'mobx';
import { Provider } from 'mobx-react';

import { GlobalStyles } from './styles';
import { delay } from './util/promise';
import { initMetrics } from './metrics';
import { appHistory } from './routing';

import { HttpExchange } from './types';

import { UiStore } from './model/ui/ui-store';
import { AccountStore } from './model/account/account-store';
import { ProxyStore } from './model/proxy-store';
import { EventsStore } from './model/events/events-store';
import { RulesStore } from './model/rules/rules-store';
import { InterceptorStore } from './model/interception/interceptor-store';
import { ApiStore } from './model/api/api-store';
import { SendStore } from './model/send/send-store';

import { serverVersion, lastServerVersion, UI_VERSION } from './services/service-versions';
import {
    attemptServerUpdate,
    checkForOutdatedComponents,
    runBackgroundUpdates
} from './services/update-management';

import { App } from './components/app';
import { StyleProvider } from './components/style-provider';
import { ErrorBoundary } from './components/error-boundary';

console.log(`Initialising UI (version ${UI_VERSION})`);

const APP_ELEMENT_SELECTOR = '#app';

mobx.configure({ enforceActions: 'observed' });

// Begin checking for updates and pre-caching UI components we might need, to support
// background updates & instant offline startup. We slightly delay this to avoid
// competing for bandwidth/CPU/etc with startup on slow connections.
delay(5000).then(runBackgroundUpdates);
checkForOutdatedComponents();

const accountStore = new AccountStore(
    () => appHistory.navigate('/settings')
);
const apiStore = new ApiStore(accountStore);
const uiStore = new UiStore(accountStore);
const proxyStore = new ProxyStore(accountStore);
const interceptorStore = new InterceptorStore(proxyStore, accountStore);

// Some non-trivial interactions between rules & events stores here. Rules need to use events to
// handle breakpoints (where rule logic reads from received event data), while events need to use
// rules to store metadata about the rule that a received event says it matched with:
const rulesStore = new RulesStore(accountStore, proxyStore,
    async function jumpToExchange(exchangeId: string) {
        await eventsStore.initialized;

        let exchange: HttpExchange;
        await mobx.when(() => {
            exchange = _.find(eventsStore.exchanges, { id: exchangeId })!;
            // Completed -> doesn't fire for initial requests -> no completed/initial req race
            return !!exchange && exchange.isCompletedRequest();
        });

        appHistory.navigate(`/view/${exchangeId}`);
        return exchange!;
    }
);
const eventsStore = new EventsStore(proxyStore, apiStore, rulesStore);
const sendStore = new SendStore(eventsStore, rulesStore);

const stores = {
    accountStore,
    apiStore,
    uiStore,
    proxyStore,
    eventsStore,
    interceptorStore,
    rulesStore,
    sendStore
};

const appStartupPromise = Promise.all(
    Object.values(stores).map(store => store.initialized)
);
initMetrics();

// Once the app is loaded, show the app
appStartupPromise.then(() => {
    // We now know that the server is running - tell it to check for updates
    attemptServerUpdate();

    console.log('App started, rendering');

    document.dispatchEvent(new Event('load:rendering'));
    ReactDOM.render(
        <Provider {...stores}>
            <StyleProvider>
                <ErrorBoundary>
                    <GlobalStyles />
                    <App />
                </ErrorBoundary>
            </StyleProvider>
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
    logError(e);

    appStartupPromise.then(() => {
        serverVersion.then(async (currentVersion) => {
            console.log('Server version was', await lastServerVersion, 'now started late with', currentVersion);
            logError('Successfully initialized application, but after timeout');
        });
    });
});

if (module.hot) {
    module.hot.accept();
}