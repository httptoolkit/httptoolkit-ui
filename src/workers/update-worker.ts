import { initSentry, reportError } from '../errors';
initSentry(process.env.SENTRY_DSN);

import WorkboxNamespace from 'workbox-sw';
import * as semver from 'semver';

import * as appPackage from '../../package.json';
import { getVersion as getServerVersion } from '../model/htk-client';

const appVersion = appPackage.version;
const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css?family=Fira+Mono|Lato';

type PrecacheEntry = {
    url: string;
    revision: string;
} | string;

// Webpack has injected these for us automatically
declare const self: ServiceWorkerGlobalScope;
declare const workbox: typeof WorkboxNamespace;
declare const __precacheManifest: Array<PrecacheEntry>;

workbox.core.setLogLevel(workbox.core.LOG_LEVELS.silent);
workbox.core.setCacheNameDetails({
    prefix: 'http-toolkit',
    precache: 'precache',
    runtime: 'runtime'
});
const precacheName = workbox.core.cacheNames.precache;

function mapPrecacheEntry(entry: PrecacheEntry, url: string, targetUrl: string) {
    if (typeof entry === 'string' && entry === url) {
        return targetUrl;
    } else if (typeof entry === 'object' && entry.url === url) {
        return { url: targetUrl, revision: entry.revision };
    } else {
        return entry;
    }
}

function getAllRegexGroupMatches(input: string, regex: RegExp, groupIndex = 1): string[] {
    const matches: string[] = [];
    let match = regex.exec(input);
    while (match !== null) {
        matches.push(match[groupIndex]);
        match = regex.exec(input);
    }
    return matches;
}

const precacheController = new workbox.precaching.PrecacheController();

async function getGoogleFontsUrlsToPrecache() {
    const fontsCssResponse = await fetch(GOOGLE_FONTS_URL);
    const fontsCss = await fontsCssResponse.text();
    const fontUrls = getAllRegexGroupMatches(fontsCss, /url\(([^\)]+)\)/g);

    // Tiny race condition here: the above could return different font CSS than
    // the later request for the fonts URL. Very unlikely though, and not a major problem.
    return [GOOGLE_FONTS_URL, ...fontUrls];
}

async function buildPrecacheList() {
    // If we fail to precache google fonts, don't worry about it too much, it's ok.
    // Doesn't cause problems because this is served with stale-while-revalidate.
    const googleFontsUrls = await getGoogleFontsUrlsToPrecache().catch(() => []);

    return __precacheManifest.map((precacheEntry) =>
        mapPrecacheEntry(precacheEntry, 'index.html', '/')
    ).concat(googleFontsUrls);
};

async function precacheNewVersionIfSupported() {
    const [precacheList, serverVersion] = await Promise.all([buildPrecacheList(), getServerVersion()]);
    console.log(`Connected httptoolkit-server version is ${serverVersion}.`);
    console.log(`App requires server version satisfying ${appPackage.runtimeDependencies['httptoolkit-server']}.`);

    if (!semver.satisfies(serverVersion, appPackage.runtimeDependencies['httptoolkit-server'])) {
        throw new Error(
            `New app version ${appVersion} available, but server ${serverVersion} is out of date - aborting`
        );
    } else {
        console.log('Server version is sufficient, continuing install...');
    }

    precacheController.addToCacheList(precacheList);

    const result = await precacheController.install();
    console.log(`New precache installed, ${result.updatedEntries.length} files updated.`);
}

self.addEventListener('install', (event: ExtendableEvent) => {
    console.log(`SW installing for version ${appVersion}`);
    event.waitUntil(precacheNewVersionIfSupported());
});

self.addEventListener('activate', (event) => {
    console.log(`SW activating for version ${appVersion}`);
    // We assume here that the server version is still good. It could not be if
    // it's been downgraded, but now that the app is running, it's the app's problem.
    event.waitUntil(precacheController.activate({}));
});

const precacheOnly = workbox.strategies.cacheOnly({ cacheName: precacheName });

const tryFromPrecacheAndRefresh = workbox.strategies.staleWhileRevalidate({
    cacheName: precacheName
});

// Webpack Dev Server goes straight to the network:
workbox.routing.registerRoute(/\/sockjs-node\/.*/, workbox.strategies.networkOnly());

// API routes aren't preloaded (there's thousands, it'd kill everything), but if we
// try to keep your recently used ones around for offline use.
workbox.routing.registerRoute(/api\/.*/, workbox.strategies.staleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
        new workbox.expiration.Plugin({
            maxEntries: 20,
        }),
    ],
}));

// All other app code _must_ be precached - no random updates from elsewhere please.
workbox.routing.registerRoute(/\/.*/, precacheOnly);

// We allow new fonts to come in automatically, but use the cache first
workbox.routing.registerRoute(/https:\/\/fonts\.googleapis\.com\/.*/, tryFromPrecacheAndRefresh);
workbox.routing.registerRoute(/https:\/\/fonts\.gstatic\.com\/.*/, tryFromPrecacheAndRefresh);

// Patch the workbox router to handle disappearing precaches:
const router = workbox.routing as any;
const handleReq = router.handleRequest;

let resettingSw = false;
router.handleRequest = function (event: FetchEvent) {
    const responsePromise = handleReq.call(router, event);
    if (responsePromise) {
        return responsePromise.then((result: any) => {
            if (result == null && !resettingSw) {
                // Somehow we're returning a broken null/undefined response.
                // This can happen if the precache somehow disappears. Though in theory
                // that shouldn't happen, it does seem to very occasionally, and it
                // then breaks app loading. If this does somehow happen, refresh everything:
                reportError(`Null result for ${event.request.url}, resetting SW.`);

                // Refresh the SW (won't take effect until after all pages unload).
                self.registration.unregister();
                // Drop the precache entirely in the meantime, since it's corrupt.
                caches.delete(precacheName);

                resettingSw = true;
            }

            if (resettingSw) {
                // Fallback to a real network request until the SW cache is rebuilt
                return fetch(event.request);
            } else {
                return result;
            }
        });
    }
    return responsePromise;
}