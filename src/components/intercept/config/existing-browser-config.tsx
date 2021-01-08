import * as React from 'react';
import { observer } from 'mobx-react';
import { observable } from 'mobx';
import dedent from 'dedent';

import { trackEvent } from '../../../tracking';

import { Interceptor } from '../../../model/interception/interceptors';

@observer
class ExistingBrowserConfig extends React.Component<{
    interceptor: Interceptor,
    activateInterceptor: (options?: { closeConfirmed: true }) => Promise<void>,
    showRequests: () => void,
    closeSelf: () => void
}> {

    @observable serverPort?: number;

    async componentDidMount() {
        this.props.closeSelf(); // We immediately unmount, but continue activating:

        try {
            // Try to activate, assuming the browser isn't currently open:
            await this.props.activateInterceptor();
        } catch (error) {
            if (error.metadata?.closeConfirmRequired === true) {
                // If the browser is open, confirm that we can kill & restart it first:
                const confirmed = confirm(dedent`
                    Your browser is currently open, and needs to be
                    restarted to enable interception. Restart it now?
                `.replace('\n', ' '));
                if (confirmed) {
                    await this.props.activateInterceptor({ closeConfirmed: true });
                } else {
                    // If cancelled, we silently do nothing
                    return;
                }
            } else {
                throw error;
            }
        }

        this.props.showRequests();
        trackEvent({
            category: 'Interceptors',
            action: 'Successfully Activated',
            label: this.props.interceptor.id
        });
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