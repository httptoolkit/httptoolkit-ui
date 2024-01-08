import { initSentry, logError } from '../errors';
initSentry(process.env.SENTRY_DSN);

// Used elsewhere in server API requests later to get the auth token:
import * as localForage from 'localforage';
localForage.config({ name: "httptoolkit", version: 1 });

import { registerRoute, NavigationRoute } from 'workbox-routing';
import { PrecacheController } from 'workbox-precaching'
import { ExpirationPlugin } from 'workbox-expiration';
import { StaleWhileRevalidate, NetworkOnly } from 'workbox-strategies';

import packageMetadata from '../../package.json';
import { getServerVersion } from './server-api';
import { lastServerVersion, versionSatisfies } from './service-versions';

const appVersion = process.env.UI_VERSION || "Unknown";

type PrecacheEntry = {
    url: string;
    revision: string;
} | string;

// Webpack has injected these for us automatically
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<PrecacheEntry> };

const __precacheManifest = self.__WB_MANIFEST; // This is injected by webpack's InjectManifest

function getPrecacheController() {
    const controller = new PrecacheController();
    // Errors will appear here if running from 'localhost' in dev mode - that's fine, we
    // don't inject this in dev mode, nothing to worry about. If you want to test this, use
    // a prod build instead (npm run start:prod)
    controller.addToCacheList(__precacheManifest);
    return controller;
}

const precacheController = getPrecacheController();
const precacheName = precacheController.strategy.cacheName;

async function precacheNewVersionIfSupported(event: ExtendableEvent) {
    await checkServerVersion();

    // Any required as the install return types haven't been updated for v4, so still use 'updatedEntries'
    const result: any = await precacheController.install(event);
    console.log(`New precache installed, ${result.updatedURLs.length} files updated.`);
}

async function checkServerVersion() {
    const serverVersion = await getServerVersion().catch(async (e) => {
        console.log("Failed to get server version. Fallback back to last version anyway...");
        logError(e);

        // This isn't perfect, but it's a pretty good approximation of when it's safe to update
        // This only happens if we get an outdated authToken (possible) or we start before the server.
        const cachedServerVersion = await lastServerVersion;
        if (cachedServerVersion) return cachedServerVersion;

        // This should never happen: the serverStatus checks should guarantee that we can
        // talk to the server in almost all cases, or that we have cached data. Fail & report it.
        throw new Error("No server version available in UI update worker");
    });

    console.log(`Connected httptoolkit-server version is ${serverVersion}.`);
    console.log(`App requires server version satisfying ${
        packageMetadata.runtimeDependencies['httptoolkit-server']
    }.`);

    if (!versionSatisfies(serverVersion, packageMetadata.runtimeDependencies['httptoolkit-server'])) {
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
    console.log(`SW installing for version ${appVersion}`);
    event.waitUntil(
        precacheNewVersionIfSupported(event)
        .catch((rawError) => {
            console.log(rawError);
            const error = new Error("SW precache failed: " + rawError.message);
            logError(error);
            throw error;
        })
    );
});

self.addEventListener('activate', async (event) => {
    console.log('Update worker activating...');
    event.waitUntil((async () => {
        console.log(`SW activating for version ${appVersion}`);

        // This can be removed only once we know that _nobody_ is using SWs from before 2019-05-09
        deleteOldWorkboxCaches();

        await precacheController.activate(event);

        // Delete the old (now unused) SW event logs
        indexedDB.deleteDatabase('keyval-store');
    })());
});

const localPathMatcher = (regex: RegExp) => ({ url }: { url: URL }): boolean | string[] => {
    // Matches the logic of Workbox's RegExpRoute, more or less, but enforcing local-only
    // matches explicitly, without the annoying warnings, and just matching the path:

    if (url.origin !== location.origin) return false;
    const matchResult = regex.exec(url.pathname);
    if (!matchResult) return false;
    else return matchResult.slice(1);
};

// Webpack Dev Server goes straight to the network:
registerRoute(localPathMatcher(/\/sockjs-node\/.*/), new NetworkOnly());

// API routes aren't preloaded (there's thousands, it'd kill everything), but we
// try to keep your recently used ones around for offline use.
registerRoute(localPathMatcher(/\/api\/.*/), new StaleWhileRevalidate({
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

// All other (non-API) app code _must_ be precached - no random updates from elsewhere.
// The below is broadly based on the precaching.addRoute, but resetting the cache
// 100% if any requests ever fail to match.
let resettingSw = false;
registerRoute(localPathMatcher(/\/.*/), async ({ event }) => {
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

    // Somehow we're returning a broken null/undefined response.
    // This can happen if the precache somehow disappears. Though in theory
    // that shouldn't happen, it does seem to very occasionally, and it
    // then breaks app loading. If this does somehow happen, refresh everything:
    logError(`Null result for ${event.request.url}, resetting SW.`);

    // Refresh the SW (won't take effect until after all pages unload).
    self.registration.unregister();
    // Drop the precache entirely in the meantime, since it's corrupt.
    caches.delete(precacheName);
    // Ensure all requests for now bypass the cache logic entirely
    resettingSw = true;

    // Fallback to a real network request until the SW cache is rebuilt
    return fetch(event.request);
}