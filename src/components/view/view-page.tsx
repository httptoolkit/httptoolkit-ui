import * as React from 'react';
import * as _ from 'lodash';
import { observable, autorun, action, computed, runInAction, when } from 'mobx';
import { observer, disposeOnUnmount, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';
import { useHotkeys as rawUseHotkeys } from "react-hotkeys-hook";

import { WithInjected } from '../../types';
import { styled } from '../../styles';

import { UiStore } from '../../model/ui-store';
import { ServerStore } from '../../model/server-store';
import { EventsStore, CollectedEvent } from '../../model/http/events-store';
import { HttpExchange } from '../../model/http/exchange';

import { SplitPane } from '../split-pane';
import { EmptyState } from '../common/empty-state';

import { ViewEventList } from './view-event-list';
import { ExchangeDetailsPane } from './exchange-details-pane';
import { TlsFailureDetailsPane } from './tls-failure-details-pane';
import { ThemedSelfSizedEditor } from '../editor/base-editor';

interface ViewPageProps {
    className?: string;
    eventsStore: EventsStore;
    serverStore: ServerStore;
    uiStore: UiStore;
    navigate: (path: string) => void;
    eventId?: string;
}

// Is the element an editable field, for which we shouldn't add keyboard shortcuts?
// We don't worry about readonly, because that might still be surprising.
const isEditable = (target: EventTarget | null) => {
    if (!target) return false;
    const element = target as HTMLElement;
    const tagName = element.tagName;
    return element.isContentEditable ||
        tagName === 'TEXTAREA' ||
        tagName === 'INPUT' ||
        tagName === 'SELECT';
}

const useHotkeys = (keys: string, callback: (event: KeyboardEvent) => void, deps: any[]) =>
    rawUseHotkeys(keys, callback, { filter: () => true }, deps);

const ViewPageKeyboardShortcuts = (props: {
    selectedEvent: CollectedEvent | undefined,
    onPin: (event: HttpExchange) => void,
    onDelete: (event: CollectedEvent) => void
}) => {
    useHotkeys('p', (event) => {
        if (isEditable(event.target)) return;

        if (props.selectedEvent instanceof HttpExchange) {
            props.onPin(props.selectedEvent);
        }
    }, [props.selectedEvent, props.onPin]);

    useHotkeys('Delete', (event) => {
        if (isEditable(event.target)) return;

        if (props.selectedEvent) {
            props.onDelete(props.selectedEvent);
        }
    }, [props.selectedEvent, props.onDelete]);

    return null;
};

@inject('eventsStore')
@inject('serverStore')
@inject('uiStore')
@observer
class ViewPage extends React.Component<ViewPageProps> {

    requestEditor = portals.createHtmlPortalNode<typeof ThemedSelfSizedEditor>();
    responseEditor = portals.createHtmlPortalNode<typeof ThemedSelfSizedEditor>();

    private listRef = React.createRef<ViewEventList>();

    @observable searchFilter: string = '';

    @computed
    get filteredEvents() {
        const { events } = this.props.eventsStore;
        if (!this.searchFilter) return events;

        let filter = this.searchFilter.toLocaleLowerCase();
        return events.filter((event) => {
            return event.searchIndex.includes(filter)
        });
    }

    @computed
    get selectedEvent() {
        return _.find(this.props.eventsStore.events, {
            id: this.props.eventId
        });
    }

    componentDidMount() {
        disposeOnUnmount(this, autorun(() => {
            if (!this.props.eventId) return;

            const selectedEvent = this.selectedEvent;

            // If you somehow have a non-existent event selected, unselect it
            if (!selectedEvent) {
                this.onSelected(undefined);
                return;
            }

            const { expandedCard } = this.props.uiStore;

            if (!expandedCard) return;

            // If you have a pane expanded, and select an event with no data
            // for that pane, then disable the expansion
            if (
                !(selectedEvent instanceof HttpExchange) ||
                (
                    expandedCard === 'requestBody' &&
                    !selectedEvent.hasRequestBody() &&
                    !selectedEvent.requestBreakpoint
                ) ||
                (
                    expandedCard === 'responseBody' &&
                    !selectedEvent.hasResponseBody() &&
                    !selectedEvent.responseBreakpoint
                )
            ) {
                runInAction(() => {
                    this.props.uiStore.expandedCard = undefined;
                });
                return;
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
        } else if ('request' in this.selectedEvent) {
            rightPane = <ExchangeDetailsPane
                exchange={this.selectedEvent}
                requestEditor={this.requestEditor}
                responseEditor={this.responseEditor}
                navigate={this.props.navigate}
                onDelete={this.onDelete}
                onScrollToEvent={this.onScrollToEvent}
            />;
        } else {
            rightPane = <TlsFailureDetailsPane failure={this.selectedEvent} certPath={certPath} />;
        }

        return <div className={this.props.className}>
            <ViewPageKeyboardShortcuts
                selectedEvent={this.selectedEvent}
                onPin={this.onPin}
                onDelete={this.onDelete}
            />
            <SplitPane
                split='vertical'
                primary='second'
                defaultSize='50%'
                minSize={300}
                maxSize={-300}
            >
                <ViewEventList
                    events={events}
                    filteredEvents={this.filteredEvents}
                    selectedEvent={this.selectedEvent}
                    isPaused={isPaused}
                    searchInput={this.searchFilter}

                    onSelected={this.onSelected}
                    onSearchInput={this.onSearchInput}
                    onClear={clearInterceptedData}

                    ref={this.listRef}
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
    onSearchInput(input: string) {
        this.searchFilter = input;
    }

    @action.bound
    onSelected(event: CollectedEvent | undefined) {
        this.props.navigate(event
            ? `/view/${event.id}`
            : '/view'
        );
    }

    @action.bound
    onPin(event: HttpExchange) {
        event.pinned = !event.pinned;
    }

    @action.bound
    onDelete(event: CollectedEvent) {
        // Prompt before deleting pinned events:
        if (event.pinned && !confirm("Delete this pinned exchange?")) return;

        const rowIndex = this.filteredEvents.indexOf(event);
        const wasSelected = event === this.selectedEvent;

        // If you delete the selected event, select the next event in the list
        if (rowIndex !== -1 && wasSelected && this.filteredEvents.length > 0) {
            // Because navigate is async, we can't delete & change selection together.
            // Instead, we update the selection now, and delete the event later.
            const nextEvent = this.filteredEvents[
                Math.min(rowIndex + 1, this.filteredEvents.length - 1)
            ];

            this.onSelected(nextEvent);
            when(() => this.selectedEvent === nextEvent, () => {
                this.props.eventsStore.deleteEvent(event);
            });
        } else {
            this.props.eventsStore.deleteEvent(event);
        }
    }

    @action.bound
    onScrollToEvent(event: CollectedEvent) {
        this.listRef.current?.scrollToEvent(event);
    }
}

const StyledViewPage = styled(
    // Exclude stores etc from the external props, as they're injected
    ViewPage as unknown as WithInjected<typeof ViewPage, 'uiStore' | 'serverStore' | 'eventsStore' | 'navigate'>
)`
    height: 100vh;
    position: relative;
`;

export { StyledViewPage as ViewPage };