import registerUpdateWorker, {
    ServiceWorkerNoSupportError
} from 'service-worker-loader!./ui-update-worker';

import { triggerServerUpdate } from './server-api';

export const attemptServerUpdate = () =>
    triggerServerUpdate().catch(console.warn);

// Set up a SW in the background, to add offline support & instant startup.
// This also checks for new UI & server versions at intervals.
export async function runBackgroundUpdates() {
    // Try to trigger a server update. Can't guarantee it'll work, and we also trigger it
    // after successful startup, but this tries to ensure that even if startup is broken,
    // we still update the server (and hopefully thereby unbreak app startup).
    attemptServerUpdate();

    try {
        const registration = await registerUpdateWorker({ scope: '/' });
        console.log('Service worker loaded');
        registration.update().catch(console.log);

        // Check for server & UI updates every 5 minutes:
        setInterval(() => {
            attemptServerUpdate();
            registration.update().catch(console.log);
        }, 1000 * 60 * 5);
    } catch (e) {
        if (e instanceof ServiceWorkerNoSupportError) {
            console.log('Service worker not supported, oh well, no autoupdating for you.');
        }
        throw e;
    }
}