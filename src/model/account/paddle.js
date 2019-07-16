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
        // We wrap Paddle.js to ensure everything is registered globally, because _half_ of
        // Paddle.js assumes that that's the case, and mobile-detecting viewport management
        // breaks if module or define are defined.
        code: `
            (function () {
                const define = undefined;
                const module = undefined;
                ${paddleScript}
            })();

            // Paddle.js creates a global - this exports it as well, for easy usage
            module.exports = window.Paddle;
        `
    }));
}