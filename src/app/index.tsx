import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { injectGlobalStyles, ThemeProvider, lightTheme as theme } from './styles';
import { App } from './components/app';
import { Store } from './model/store';
import { Provider } from 'mobx-react';

injectGlobalStyles(theme);

const APP_ELEMENT_SELECTOR = '#app';

window.onload = async function startApp() {
    const store = new Store();
    await store.startServer();

    ReactDOM.render(
        <Provider store={store}>
            <ThemeProvider theme={theme}>
                <App />
            </ThemeProvider>
        </Provider>
    , document.querySelector(APP_ELEMENT_SELECTOR));
}

if (module.hot) {
    module.hot.accept('.', function() {
        window.location.reload();
    })
}