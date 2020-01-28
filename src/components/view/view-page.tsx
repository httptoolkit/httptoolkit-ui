import * as React from 'react';
import * as _ from 'lodash';
import { autorun, action, computed } from 'mobx';
import { observer, disposeOnUnmount, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { WithInjected } from '../../types';
import { styled } from '../../styles';

import { EventsStore } from '../../model/events-store';
import { ServerStore } from '../../model/server-store';

import { SplitPane } from '../split-pane';
import { EmptyState } from '../common/empty-state';

import { ViewEventList, CollectedEvent } from './view-event-list';
import { ExchangeDetailsPane } from './exchange-details-pane';
import { ExchangeBreakpointPane } from './exchange-breakpoint-pane';
import { TlsFailureDetailsPane } from './tls-failure-details-pane';
import { ThemedSelfSizedEditor } from '../editor/base-editor';

interface ViewPageProps {
    className?: string;
    eventsStore: EventsStore;
    serverStore: ServerStore;
    navigate: (path: string) => void;
    eventId?: string;
}

@inject('eventsStore')
@inject('serverStore')
@observer
class ViewPage extends React.Component<ViewPageProps> {

    requestEditor = portals.createPortalNode<typeof ThemedSelfSizedEditor>();
    responseEditor = portals.createPortalNode<typeof ThemedSelfSizedEditor>();

    @computed
    get selectedEvent() {
        return _.find(this.props.eventsStore.events, {
            id: this.props.eventId
        });
    }

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            // If you somehow have a non-existent event selected, unselect it
            if (
                this.props.eventId &&
                !_.includes(this.props.eventsStore.events, this.selectedEvent)
            ) {
                this.onSelected(undefined);
            }
        }));
    }

    render(): JSX.Element {
        const {
            events,
            clearInterceptedData,
            isPaused
        } = this.props.eventsStore;
        const { certPath } = this.props.serverStore;

        let rightPane: JSX.Element;
        if (!this.selectedEvent) {
            rightPane = <EmptyState icon={['fas', 'arrow-left']}>
                Select an exchange to see the full details.
            </EmptyState>;
        } else if ('isBreakpointed' in this.selectedEvent && this.selectedEvent.isBreakpointed) {
            rightPane = <ExchangeBreakpointPane
                exchange={this.selectedEvent}
                editorNode={this.requestEditor}
            />
        } else if ('request' in this.selectedEvent) {
            rightPane = <ExchangeDetailsPane
                exchange={this.selectedEvent}
                requestEditor={this.requestEditor}
                responseEditor={this.responseEditor}
                navigate={this.props.navigate}
            />;
        } else {
            rightPane = <TlsFailureDetailsPane failure={this.selectedEvent} certPath={certPath} />;
        }

        return <div className={this.props.className}>
            <SplitPane
                split='vertical'
                primary='second'
                defaultSize='50%'
                minSize={300}
                maxSize={-300}
            >
                <ViewEventList
                    selectedEvent={this.selectedEvent}
                    onSelected={this.onSelected}
                    onClear={clearInterceptedData}
                    events={events}
                    isPaused={isPaused}
                />
                { rightPane }
            </SplitPane>

            {[this.requestEditor, this.responseEditor].map((editorNode, i) =>
                <portals.InPortal key={i} node={editorNode}>
                    <ThemedSelfSizedEditor />
                </portals.InPortal>
            )}
        </div>;
    }

    @action.bound
    onSelected(event: CollectedEvent | undefined) {
        this.props.navigate(event
            ? `/view/${event.id}`
            : '/view'
        );
    }
}

const StyledViewPage = styled(
    // Exclude stores from the external props, as they're injected
    ViewPage as unknown as WithInjected<typeof ViewPage, 'serverStore' | 'eventsStore' | 'navigate'>
)`
    height: 100vh;
    position: relative;
`;

export { StyledViewPage as ViewPage };