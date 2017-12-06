import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Main } from './components/main';

window.onload = function(){
    ReactDOM.render(<Main />, document.getElementById('app'));
}

if (module.hot) {
    module.hot.accept('.', function() {
        window.location.reload();
    })
}