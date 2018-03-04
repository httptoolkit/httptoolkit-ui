import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'react-redux'

import styled, { injectGlobal } from 'styled-components';
import reset from 'styled-reset'

import { AppContainer } from './components/app';
import { getStore } from './model/store';

injectGlobal`
    ${reset};
`;

const APP_ELEMENT_SELECTOR = "#app";

window.onload = async function startApp() {
    const store = await getStore();

    ReactDOM.render(
        <Provider store={store}>
            <AppContainer />
        </Provider>
    , document.querySelector(APP_ELEMENT_SELECTOR));
}

if (module.hot) {
    module.hot.accept('.', function() {
        window.location.reload();
    })
}