import dedent from 'dedent';

import { Interceptor } from '../../../model/interception/interceptors';

export async function onActivateExistingBrowser(
    interceptor: Interceptor,
    activateInterceptor: (
        options: { closeConfirmed?: true },
        shouldTrackEvent?: false
    ) => Promise<void>,
    reportStarted: () => void,
    reportSuccess: (options?: { showRequests?: boolean }) => void,
) {
    try {
        // Try to activate, assuming the browser isn't currently open:
        await activateInterceptor({}, false);

        // Only it runs without confirmation does this count as an activation
        reportStarted();
    } catch (error: any) {
        if (!error.metadata || error.metadata.closeConfirmRequired !== true) {
            // This is a real error, not a confirmation requirement.

            reportStarted(); // Track that this started, before it fails
            throw error;
        }

        // If the browser is open, confirm that we can kill & restart it first:
        const confirmed = confirm(dedent`
            Your browser is currently open, and needs to be
            restarted to enable interception. Restart it now?
        `.replace('\n', ' '));

        // If cancelled, we silently do nothing
        if (!confirmed) return;

        reportStarted();
        await activateInterceptor({ closeConfirmed: true });
    }

    reportSuccess();
}