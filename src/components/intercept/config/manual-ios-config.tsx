import * as _ from 'lodash';
import * as React from 'react';
import { inject, observer } from 'mobx-react';
import { when } from 'mobx';

import { Interceptor } from '../../../model/interception/interceptors';
import { EventsStore } from '../../../model/events/events-store';
import { SourceIcons } from '../../../icons';

@inject('eventsStore')
@observer
class ManualIOSConfig extends React.Component<{
    eventsStore?: EventsStore,

    interceptor: Interceptor,

    activateInterceptor: () => Promise<void>,
    reportStarted: () => void,
    reportSuccess: (options?: { showRequests?: boolean }) => void,
    closeSelf: () => void
}> {

    async componentDidMount() {
        const { eventsStore, reportStarted, reportSuccess, closeSelf } = this.props;
        closeSelf(); // We immediately unmount, but continue activating:

        // Open the manual setup docs page:
        window.open(
            "https://httptoolkit.com/docs/guides/ios/",
            "_blank",
            "noreferrer noopener"
        );

        reportStarted();

        // When we receive the next iOS-appearing request, we consider this as successful
        // and then jump to the View page:
        const previousIOSRequestIds = getIOSRequestIds(eventsStore!);
        when(() =>
            _.difference(
                getIOSRequestIds(eventsStore!),
                previousIOSRequestIds
            ).length > 0
        ).then(() => {
            reportSuccess()
        });
    }

    render() {
        return null; // This never actually displays - we just mount, open the page, and close
    }

}

function getIOSRequestIds(eventsStore: EventsStore) {
    return eventsStore.exchanges.filter((exchange) =>
        _.isEqual(exchange.request.source.icon, SourceIcons.iOS)
    ).map(e => e.id);
}

export const ManualIOSCustomUi = {
    columnWidth: 1,
    rowHeight: 1,
    configComponent: ManualIOSConfig
};