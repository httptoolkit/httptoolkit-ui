import { initSentry, reportError, Sentry } from '../errors';
initSentry(process.env.SENTRY_DSN);

import WorkboxNamespace from 'workbox-sw';
import * as kv from 'idb-keyval';
import * as localForage from 'localforage';

import * as appPackage from '../../package.json';
import { getServerVersion } from './server-api';
import { lastServerVersion, versionSatisfies } from './service-versions';
import { delay } from '../util/promise';

const appVersion = process.env.COMMIT_REF || "Unknown";
const SW_LOG = 'sw-log';
localForage.config({ name: "httptoolkit", version: 1 });

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

    data.quota = navigator.storage && navigator.storage.estimate
        ? await navigator.storage.estimate()
        : {};

    data.precached = await getCacheUrls(precacheName);
    data.tmpPrecached = await getCacheUrls(precacheName + '-temp');

    logData.push(data);
    kv.set(SW_LOG, logData);
}

writeToLog({ type: 'startup' });

// Check if the server is accessible, and that we've been given the relevant auth
// details. If we haven't, that means the desktop has started the server with an
// auth token, but we haven't received it. In general, that means the UI hasn't
// passed it on, because it's outdated and doesn't understand it. To fix this,
// we forcibly update the UI immediately. Should only ever happen once.

type ServerStatus = 'accessible' | 'auth-required' | 'inaccessible'
const serverStatus: Promise<ServerStatus> =
    fetch("http://localhost:45457/")
    .then((response) => {
        if (response.status === 403) return 'auth-required';
        else return 'accessible';
    })
    .catch(() => 'inaccessible' as ServerStatus)
    .then((status) => {
        console.log('Service worker server status:', status);
        return status;
    });

const forceUpdateRequired = serverStatus.then(async (status) => {
    // Update should be forced if we're using a server that requires auth,
    // but the UI hasn't properly provided an auth token.
    return status === 'auth-required' &&
        !(await localForage.getItem<string>('latest-auth-token'));
});

type PrecacheEntry = {
    url: string;
    revision: string;
} | string;

// Webpack has injected these for us automatically
declare const self: ServiceWorkerGlobalScope;
declare const workbox: typeof WorkboxNamespace;
declare const __precacheManifest: Array<PrecacheEntry>;

const precacheName = workbox.core.cacheNames.precache;

function getPrecacheController() {
    const controller = new workbox.precaching.PrecacheController();

    const precacheList = __precacheManifest.filter((precacheEntry) => {
        const entryUrl = typeof precacheEntry === 'object' ? precacheEntry.url : precacheEntry;
        return !entryUrl.startsWith('api/');
    });

    controller.addToCacheList(precacheList);
    return controller;
}

const precacheController = getPrecacheController();

async function precacheNewVersionIfSupported() {
    if (await forceUpdateRequired) {
        // Don't bother precaching: we want to take over & then force kill/refresh everything ASAP
        self.skipWaiting();
        reportError("Force update required on newly installed SW");
        return;
    }

    await checkServerVersion();

    // Any required as the install return types haven't been updated for v4, so still use 'updatedEntries'
    const result: any = await precacheController.install();
    console.log(`New precache installed, ${result.updatedURLs.length} files updated.`);
}

async function checkServerVersion() {
    const serverVersion = await getServerVersion().catch(async (e) => {
        console.log("Failed to get server version. Fallback back to last version anyway...");
        reportError(e);

        // This isn't perfect, but it's a pretty good approximation of when it's safe to update
        // This only happens if we get an outdated authToken (possible) or we start before the server.
        const cachedServerVersion = await lastServerVersion;
        if (cachedServerVersion) return cachedServerVersion;

        // This should never happen: the serverStatus checks should guarantee that we can
        // talk to the server in almost all cases, or that we have cached data. Fail & report it.
        throw new Error("No server version available, even though server check passed");
    });

    console.log(`Connected httptoolkit-server version is ${serverVersion}.`);
    console.log(`App requires server version satisfying ${
        appPackage.runtimeDependencies['httptoolkit-server']
    }.`);

    if (!versionSatisfies(serverVersion, appPackage.runtimeDependencies['httptoolkit-server'])) {
        throw new Error(
            `New app version ${appVersion} available, but server ${
                await serverVersion
            } is out of date - aborting`
        );
    }

    console.log('Server version is sufficient, continuing install...');
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

self.addEventListener('activate', async (event) => {
    event.waitUntil((async () => {
        writeToLog({ type: 'activate' });
        console.log(`SW activating for version ${appVersion}`);

        if (await forceUpdateRequired) {
            reportError("Force update required on newly activated SW");
            writeToLog({ type: 'forcing-refresh' });
            resettingSw = true; // Pass through all requests

            // Take over and refresh all client pages:
            await self.clients.claim();
            const clients = await self.clients.matchAll({ type: 'window' });
            clients.map((client) => {
                console.log(`Refreshing ${client.url}`);
                return (client as WindowClient).navigate(client.url)
                    .catch(async (e) => {
                        // On the first error, try once more, after a brief delay. Sometimes
                        // claim() might not process fast enough, and this is necessary.
                        await delay(100);
                        return (client as WindowClient).navigate(client.url);
                    });
            });

            writeToLog({ type: 'refresh-forced' });

            // Unregister, so that future registration loads the SW & caches from scratch
            self.registration.unregister();
            console.log("SW forcibly refreshed");
        } else {
            // This can be removed only once we know that _nobody_ is using SWs from before 2019-05-09
            deleteOldWorkboxCaches();

            await precacheController.activate();
            writeToLog({ type: 'activated' });
        }
    })());
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

// Map all page loads to the root HTML. This is necessary to allow SPA routing,
// as otherwise a refreshes miss the cache & fail.
workbox.routing.registerNavigationRoute(
    precacheController.getCacheKeyForURL('/index.html')
);

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
            // Load /index.html for /:
            requestUrl.href.endsWith('/')
                ? requestUrl.href + 'index.html'
                : false
        ] as Array<string | false>)
        .map((cacheUrl) => cacheUrl && urlsToCacheKeys.get(cacheUrl))
        .filter((x): x is string => !!x)
    )[0]; // Use the first matching URL

    // We have a /<something> URL that isn't in the cache at all - something is very wrong
    if (!precachedUrl) {
        if (event.request.cache === 'only-if-cached') {
            // Triggered by dev tools looking for sources. We know it's indeed not cached, so we reject
            return new Response(null, { status: 504 }) // 504 is standard failure code for these

            // This is required due to https://bugs.chromium.org/p/chromium/issues/detail?id=823392
            // TODO: This can likely be removed once all Electrons are updated to include that
        }

        console.log(`${requestUrl.href} did not match any of ${[...urlsToCacheKeys.keys()]}`);
        return brokenCacheResponse(event);
    }

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