import * as React from 'react';
import { observer } from 'mobx-react';
import { observable } from 'mobx';
import dedent from 'dedent';

import { trackEvent } from '../../../tracking';

import { Interceptor } from '../../../model/interception/interceptors';

@observer
class ExistingBrowserConfig extends React.Component<{
    interceptor: Interceptor,
    activateInterceptor: (
        options: { closeConfirmed?: true },
        shouldTrackEvent?: false
    ) => Promise<void>,
    reportStarted: () => void,
    reportSuccess: (options?: { showRequests?: boolean }) => void,
    closeSelf: () => void
}> {

    @observable serverPort?: number;

    async componentDidMount() {
        const { activateInterceptor, reportStarted, reportSuccess, closeSelf } = this.props;
        closeSelf(); // We immediately unmount, but continue activating:

        try {
            // Try to activate, assuming the browser isn't currently open:
            await activateInterceptor({}, false);

            // Only it runs without confirmation does this count as an activation
            reportStarted();
        } catch (error) {
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

    render() {
        return null; // This never actually displays - we just mount, confirm, and close
    }

}

export const ExistingBrowserCustomUi = {
    columnWidth: 1,
    rowHeight: 1,
    configComponent: ExistingBrowserConfig
};