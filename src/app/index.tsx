import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Main } from './components/main';

import { getLocal } from 'mockttp';
let mockServer = getLocal();

window.onload = function(){
    ReactDOM.render(<Main server={mockServer} />, document.getElementById('app'));
}

if (module.hot) {
    module.hot.accept('.', function() {
        window.location.reload();
    })
}