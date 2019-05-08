import { initSentry, reportError, Sentry } from '../errors';
initSentry(process.env.SENTRY_DSN);

import WorkboxNamespace from 'workbox-sw';
import * as semver from 'semver';
import * as kv from 'idb-keyval';

import * as appPackage from '../../package.json';
import { getVersion as getServerVersion } from '../model/htk-client';

const appVersion = process.env.COMMIT_REF || "Unknown";
const SW_LOG = 'sw-log';

async function readLog(): Promise<Array<any>> {
    const currentLog = await kv.get<Array<any>>(SW_LOG);
    return currentLog || [];
}

async function getCacheUrls(cacheName: string): Promise<string[]> {
    return (
        await (
            await caches.open(cacheName)
        ).keys()
    ).map(r => r.url);
}

async function writeToLog(data: any) {
    data.v = appVersion;
    data.dt = Date.now();

    const logData = await readLog();

    data.quota = await navigator.storage.estimate();

    data.precached = await getCacheUrls(precacheName);
    data.tmpPrecached = await getCacheUrls(precacheName + '-temp');

    logData.push(data);
    kv.set(SW_LOG, logData);
}

writeToLog({ type: 'startup' });

type PrecacheEntry = {
    url: string;
    revision: string;
} | string;

// Webpack has injected these for us automatically
declare const self: ServiceWorkerGlobalScope;
declare const workbox: typeof WorkboxNamespace;
declare const __precacheManifest: Array<PrecacheEntry>;

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

const precacheController = new workbox.precaching.PrecacheController();

async function buildPrecacheList() {
    return __precacheManifest.filter((precacheEntry) => {
        const entryUrl = typeof precacheEntry === 'object' ? precacheEntry.url : precacheEntry;
        return !entryUrl.startsWith('api/');
    });
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

    // Any required as the install return types haven't been updated for v4, so still use 'updatedEntries'
    const result: any = await precacheController.install();
    console.log(`New precache installed, ${result.updatedURLs.length} files updated.`);
}

// Async, drop leftover caches from previous workbox versions:
function deleteOldWorkboxCaches() {
    caches.keys().then((cacheKeys) => {
        cacheKeys.forEach(async (cacheKey) => {
            if (!cacheKey.startsWith('http-toolkit-precache-http')) return;

            // Drop the content cache & revisions DB
            console.log(`Deleting SW cache ${cacheKey}`);
            caches.delete(cacheKey);
            const dbName = cacheKey.replace(/[:\/]/g, '_');
            indexedDB.deleteDatabase(dbName);
        });
    });
}

self.addEventListener('install', (event: ExtendableEvent) => {
    writeToLog({ type: 'install' });
    console.log(`SW installing for version ${appVersion}`);
    event.waitUntil(precacheNewVersionIfSupported());
});

self.addEventListener('activate', (event) => {
    writeToLog({ type: 'activate' });
    console.log(`SW activating for version ${appVersion}`);

    // This can be removed only once we know that _nobody_ is using SWs from before 2019-05-09
    deleteOldWorkboxCaches();

    event.waitUntil(
        precacheController.activate()
        .then(() => {
            writeToLog({ type: 'activated' })
            return null; // Don't wait for logging
        })
    );
});

// Webpack Dev Server goes straight to the network:
workbox.routing.registerRoute(/\/sockjs-node\/.*/, new workbox.strategies.NetworkOnly());

// API routes aren't preloaded (there's thousands, it'd kill everything), but we
// try to keep your recently used ones around for offline use.
workbox.routing.registerRoute(/api\/.*/, new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
        new workbox.expiration.Plugin({
            maxEntries: 20,
        }),
    ],
}));

// All other app code _must_ be precached - no random updates from elsewhere please.
// The below is broadly based on the precaching.addRoute, but resetting the cache
// 100% if any requests ever fail to match.
let resettingSw = false;
workbox.routing.registerRoute(/\/.*/, async ({ event }) => {
    if (resettingSw) return fetch(event.request);

    const urlsToCacheKeys = precacheController.getURLsToCacheKeys();
    const requestUrl = new URL(event.request.url, self.location.toString());
    requestUrl.hash = '';

    const precachedUrl = (
        ([
            requestUrl.href,
            requestUrl.href + '.html', // Support .html requests without extension
            requestUrl.href.endsWith('/') ? requestUrl.href + 'index.html' : false, // Allow index.html for /
        ] as Array<string | false>)
        .map((cacheUrl) => cacheUrl && urlsToCacheKeys.get(cacheUrl))
        .filter((x): x is string => !!x)
    )[0]; // Use the first matching URL

    // We have a /<something> URL that isn't in the cache at all - something is very wrong
    if (!precachedUrl) return brokenCacheResponse(event);

    const cache = await caches.open(precacheName);
    const cachedResponse = await cache.match(precachedUrl);

    // If the cache is all good, use it. If not, reset everything.
    if (cachedResponse) return cachedResponse;
    else return brokenCacheResponse(event);
});

// The precache has failed: kill it, report that, and start falling back to the network
function brokenCacheResponse(event: FetchEvent): Promise<Response> {
    console.log('SW cache has failed', event);

    writeToLog({ type: 'load-failed' })
    .then(readLog)
    .then((swLogData) => {
        Sentry.withScope(scope => {
            scope.setExtra('sw-log', swLogData);

            // Somehow we're returning a broken null/undefined response.
            // This can happen if the precache somehow disappears. Though in theory
            // that shouldn't happen, it does seem to very occasionally, and it
            // then breaks app loading. If this does somehow happen, refresh everything:
            reportError(`Null result for ${event.request.url}, resetting SW.`);
        });
    });

    // Refresh the SW (won't take effect until after all pages unload).
    self.registration.unregister();
    // Drop the precache entirely in the meantime, since it's corrupt.
    caches.delete(precacheName);
    // Ensure all requests for now bypass the cache logic entirely
    resettingSw = true;

    // Fallback to a real network request until the SW cache is rebuilt
    return fetch(event.request);
}