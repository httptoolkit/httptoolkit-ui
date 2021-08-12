import { initSentry, reportError, Sentry } from '../errors';
initSentry(process.env.SENTRY_DSN);

import * as kv from 'idb-keyval';
import * as localForage from 'localforage';

import { registerRoute, NavigationRoute } from 'workbox-routing';
import { PrecacheController } from 'workbox-precaching'
import { ExpirationPlugin } from 'workbox-expiration';
import { StaleWhileRevalidate, NetworkOnly } from 'workbox-strategies';

import * as appPackage from '../../package.json';
import { getServerVersion } from './server-api';
import { lastServerVersion, versionSatisfies } from './service-versions';
import { delay } from '../util/promise';

const appVersion = process.env.UI_VERSION || "Unknown";
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
    fetch("http://127.0.0.1:45457/", { method: 'POST' })
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
    // the UI hasn't properly provided an auth token, and there is
    // currently an active service worker (i.e. a cached UI)
    return status === 'auth-required' &&
        !(await localForage.getItem<string>('latest-auth-token')) &&
        !!self.registration.active;
});

type PrecacheEntry = {
    url: string;
    revision: string;
} | string;

// Webpack has injected these for us automatically
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<PrecacheEntry> };

const __precacheManifest = self.__WB_MANIFEST; // This is injected by webpack's InjectManifest

function getPrecacheController() {
    const controller = new PrecacheController();
    controller.addToCacheList(__precacheManifest);
    return controller;
}

const precacheController = getPrecacheController();
const precacheName = precacheController.strategy.cacheName;

async function precacheNewVersionIfSupported(event: ExtendableEvent) {
    if (await forceUpdateRequired) {
        // Don't bother precaching: we want to take over & then force kill/refresh everything ASAP
        self.skipWaiting();
        reportError("Force update required on newly installed SW");
        return;
    }

    await checkServerVersion();

    // Any required as the install return types haven't been updated for v4, so still use 'updatedEntries'
    const result: any = await precacheController.install(event);
    console.log(`New precache installed, ${result.updatedURLs.length} files updated.`);
}

async function checkServerVersion() {
    const serverVersion = await getServerVersion().catch(async (e) => {
        console.log("Failed to get server version. Fallback back to last version anyway...");

        console.log(
            "Version unavailable but not forcing update, why?",
            "status", await serverStatus,
            "got token", !!(await localForage.getItem<string>('latest-auth-token')),
            "SW registrations", self.registration,
            "active SW", !!self.registration?.active
        );

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
    event.waitUntil(
        precacheNewVersionIfSupported(event)
        .catch((rawError) => {
            console.log(rawError);
            const error = new Error("SW precache failed: " + rawError.message);
            reportError(error);
            throw error;
        })
    );
});

self.addEventListener('activate', async (event) => {
    event.waitUntil(async () => {
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

            await precacheController.activate(event);
            writeToLog({ type: 'activated' });
        }
    });
});

// Webpack Dev Server goes straight to the network:
registerRoute(/\/sockjs-node\/.*/, new NetworkOnly());

// API routes aren't preloaded (there's thousands, it'd kill everything), but we
// try to keep your recently used ones around for offline use.
registerRoute(/api\/.*/, new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
        new ExpirationPlugin({
            maxEntries: 20,
        }),
    ],
}));

// Map all page loads to the root HTML. This is necessary to allow SPA routing,
// as otherwise a refreshes miss the cache & fail.
registerRoute(new NavigationRoute(
    precacheController.createHandlerBoundToURL('/index.html')
));

// All other app code _must_ be precached - no random updates from elsewhere please.
// The below is broadly based on the precaching.addRoute, but resetting the cache
// 100% if any requests ever fail to match.
let resettingSw = false;
registerRoute(/\/.*/, async ({ event }) => {
    const fetchEvent = event as FetchEvent;

    if (resettingSw) return fetch(fetchEvent.request);

    const cachedResponse = await precacheController.matchPrecache(fetchEvent.request);

    // We have a /<something> URL that isn't in the cache at all - something is very wrong
    if (!cachedResponse) {
        if (fetchEvent.request.cache === 'only-if-cached') {
            // Triggered by older dev tools looking for sources. We know it's indeed not cached, so we reject
            return new Response(null, { status: 504 }) // 504 is standard failure code for these

            // This is required due to https://bugs.chromium.org/p/chromium/issues/detail?id=823392
            // TODO: This can likely be removed once all Electrons are updated to include that
        } else if (isDevToolsRequest(fetchEvent)) {
            // New-ish devtools send real-looking requests, that do want to go through the cache, but
            // they shouldn't invalidate it (we don't cache source). They're recognizable at least, as
            // they're our-origin requests that inexplicably don't include a referrer or destination
            // (because they come from devtools):
            return fetch(fetchEvent.request);
        }

        // A missing file, on our domain, that isn't a source lookup from the devtools. Something has gone wrong:
        console.log(`${fetchEvent.request.url} did not match any of ${
            precacheController.getCachedURLs()
        }`);
        return brokenCacheResponse(fetchEvent);
    }

    return cachedResponse;
});

// Given a same-origin request, is it a DevTools source request? This seems to work well right now (Chrome 91)
// but could easily change in future, and it's getting increasingly hard to detect & handle these...
function isDevToolsRequest(event: FetchEvent) {
    return event.request.destination === '' &&
        event.request.referrer === '' &&
        !event.request.referrerPolicy.startsWith('no-referrer');
}

// The precache has failed: kill it, report that, and start falling back to the network
function brokenCacheResponse(event: FetchEvent): Promise<Response> {
    console.log('SW cache has failed for resource request', event.request);

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