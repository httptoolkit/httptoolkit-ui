import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'react-redux'

import { injectGlobalStyles, ThemeProvider, lightTheme as theme } from './styles';
import { AppContainer } from './components/app';
import { getStore } from './model/store';

injectGlobalStyles(theme);

const APP_ELEMENT_SELECTOR = '#app';

window.onload = async function startApp() {
    const config = JSON.parse((new URL(window.location.href)).searchParams.get('config') as string);
    const store = await getStore(config);

    ReactDOM.render(
        <Provider store={store}>
            <ThemeProvider theme={theme}>
                <AppContainer />
            </ThemeProvider>
        </Provider>
    , document.querySelector(APP_ELEMENT_SELECTOR));
}

if (module.hot) {
    module.hot.accept('.', function() {
        window.location.reload();
    })
}