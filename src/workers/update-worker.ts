import WorkboxNamespace from "workbox-sw";

import { version as appVersion } from '../../package.json';

type PrecacheEntry = {
    url: string;
    revision: string;
} | string;

// Webpack has injected these for us automatically
declare const self: ServiceWorkerGlobalScope;
declare const workbox: typeof WorkboxNamespace;
declare const __precacheManifest: Array<PrecacheEntry>;

workbox.core.setLogLevel(workbox.core.LOG_LEVELS.log);

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

workbox.core.setCacheNameDetails({
    prefix: 'http-toolkit',
    precache: 'precache',
    runtime: 'runtime'
});

const precacheController = new workbox.precaching.PrecacheController();

async function buildPrecacheList() {
    const fontsCssResponse = await fetch('https://fonts.googleapis.com/css?family=Fira+Mono|Lato');
    const fontsCss = await fontsCssResponse.text();
    const fontUrls = getAllRegexGroupMatches(fontsCss, /url\(([^\)]+)\)/g);

    return __precacheManifest.map((precacheEntry) =>
        mapPrecacheEntry(precacheEntry, 'index.html', '/')
    ).concat([
        // Tiny race condition here: the above could return different font URLs than
        // the next request. Very unlikely though, and not a major problem.
        'https://fonts.googleapis.com/css?family=Fira+Mono|Lato',
        ...fontUrls
    ]);
};
self.addEventListener('install', (event: ExtendableEvent) => {
    console.log(`SW installing for version ${appVersion}`);
    event.waitUntil(buildPrecacheList()
        .then(async (precacheList) => {
            precacheController.addToCacheList(precacheList);
            const result = await precacheController.install();
            console.log(`New precache installed, ${result.updatedEntries.length} files updated.`);
        })
    );
});

self.addEventListener('activate', (event) => {
    console.log(`SW activating for version ${appVersion}`);
    event.waitUntil(precacheController.activate({}));
});

const preCacheOnly = workbox.strategies.cacheOnly({
    cacheName: workbox.core.cacheNames.precache
});

const tryFromPrecacheAndRefresh = workbox.strategies.staleWhileRevalidate({
    cacheName: workbox.core.cacheNames.precache
});

// Hot Module Reload goes to the network:
workbox.routing.registerRoute(/\/.*\.hot-update\.js(on)?$/, workbox.strategies.networkOnly());
workbox.routing.registerRoute(/\/sockjs-node\/.*/, workbox.strategies.networkOnly());

// All other app code _must_ be precached - no random updates from elsewhere please.
workbox.routing.registerRoute(/\/.*/, preCacheOnly);

// We allow new fonts to come in automatically, but use the cache first
workbox.routing.registerRoute(/https:\/\/fonts\.googleapis\.com\/.*/, tryFromPrecacheAndRefresh);
workbox.routing.registerRoute(/https:\/\/fonts\.gstatic\.com\/.*/, tryFromPrecacheAndRefresh);