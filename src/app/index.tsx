import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'react-redux'

import { AppContainer } from './components/app';
import { getStore } from './store';

window.onload = async function startApp() {
    const store = await getStore();

    ReactDOM.render(
        <Provider store={store}>
            <AppContainer />
        </Provider>
    , document.getElementById('app'));
}

if (module.hot) {
    module.hot.accept('.', function() {
        window.location.reload();
    })
}