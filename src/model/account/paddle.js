const fetch = require('node-fetch');

// This file is run at _build_ time, and the output becomes the import elsewhere.
// This effectively pulls the latest paddle JS and includes it in our bundle,
// every time the app is built.
module.exports = function () {
    return fetch('https://cdn.paddle.com/paddle/paddle.js')
    .then((response) => {
        if (!response.ok) throw new Error('Could not download Paddle JS');
        return response.text();
    })
    .then((paddleScript) => ({
        code: paddleScript
    }));
}