HTTP Toolkit UI [![Build Status](https://github.com/httptoolkit/httptoolkit-ui/workflows/CI/badge.svg)](https://github.com/httptoolkit/httptoolkit-ui/actions)
===================

This repo contains the UI for [HTTP Toolkit](https://httptoolkit.tech), a beautiful, cross-platform & open-source HTTP(S) debugging proxy, analyzer & client.

Looking to file bugs, request features or send feedback? File an issue or vote on existing ones at [github.com/httptoolkit/httptoolkit](https://github.com/httptoolkit/httptoolkit).

## What is this?

HTTP Toolkit is built as a single-page web application (this repo), running on top of [a server](https://github.com/httptoolkit/httptoolkit-server) that provides access to non-web functionality (e.g. running a proxy server), typically run through [an electron desktop wrapper app](https://github.com/httptoolkit/httptoolkit-desktop). The core UI and the majority of HTTP Toolkit functionality all lives here, except for desktop-app specific behaviour & build configuration, or functionality that can't be implemented in a web app.

The UI is built as a TypeScript React app, using MobX for state and Styled Components for styling, with [Mockttp](https://github.com/httptoolkit/mockttp) used to manage the HTTP interception itself.

When running, the UI is typically used via [app.httptoolkit.tech](https://app.httptoolkit.tech), even in the desktop app (it's not embedded there, but hosted standalone). It can either be used through the desktop app (which starts its own server), or users can start their own server and open the UI in a browser directly.

## Contributing

If you want to change the behaviour of the HTTP Toolkit in almost any way, except the low-level HTTP handling (see [Mockttp](https://github.com/httptoolkit/mockttp)), how interceptors start applications (see [httptoolkit-server](https://github.com/httptoolkit/httptoolkit-server)) or how it's packaged and distributed (see [httptoolkit-desktop](https://github.com/httptoolkit/httptoolkit-desktop)), then you're in the right place :+1:.

To get started:

* Clone this repo.
* `npm install`
* For pure UI development
    * Run `npm start` to start the UI along with a backing [httptoolkit server](https://github.com/httptoolkit/httptoolkit-server).
    * Open [`local.httptoolkit.tech:8080`](http://local.httptoolkit.tech:8080) to view the UI
* To develop the UI & server together
    * Start [a server](https://github.com/httptoolkit/httptoolkit-server) locally
    * Run `npm run start:web` to start the UI without running a separate HTTP Toolkit server
    * Open [`local.httptoolkit.tech:8080`](http://local.httptoolkit.tech:8080) to view the UI
* `npm test` - run the tests (not many yet, but more are very welcome!)
