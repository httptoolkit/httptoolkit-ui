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

const precacheController = new workbox.precaching.PrecacheController();

async function buildPrecacheList() {
    return __precacheManifest.map((precacheEntry) =>
        mapPrecacheEntry(precacheEntry, 'index.html', '/')
    )
    .filter((precacheEntry) => {
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

    const result = await precacheController.install();
    console.log(`New precache installed, ${result.updatedEntries.length} files updated.`);
}

self.addEventListener('install', (event: ExtendableEvent) => {
    writeToLog({ type: 'install' });
    console.log(`SW installing for version ${appVersion}`);
    event.waitUntil(precacheNewVersionIfSupported());
});

self.addEventListener('activate', (event) => {
    writeToLog({ type: 'activate' });
    console.log(`SW activating for version ${appVersion}`);
    // We assume here that the server version is still good. It could not be if
    // it's been downgraded, but now that the app is running, it's the app's problem.
    event.waitUntil(
        precacheController.activate({})
        .then(() => {
            writeToLog({ type: 'activated' })
            return null; // Don't wait for logging
        })
    );
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

// Patch the workbox router to handle disappearing precaches:
const router = workbox.routing as any;
const handleReq = router.handleRequest;

let resettingSw = false;
router.handleRequest = function (event: FetchEvent) {
    const responsePromise = handleReq.call(router, event);
    if (responsePromise) {
        return responsePromise.then((result: any) => {
            if (result == null && !resettingSw) {
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

                resettingSw = true;
            }

            if (resettingSw) {
                // Fallback to a real network request until the SW cache is rebuilt
                return fetch(event.request);
            } else {
                if (event.request.url === 'https://app.httptoolkit.tech/') {
                    writeToLog({ type: 'load-root-ok' });
                }
                return result;
            }
        });
    }
    return responsePromise;
}