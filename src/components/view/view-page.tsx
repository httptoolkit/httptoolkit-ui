import * as React from 'react';
import * as _ from 'lodash';
import {
    observable,
    autorun,
    action,
    computed,
    runInAction,
    when,
    reaction,
    comparer
} from 'mobx';
import { observer, disposeOnUnmount, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { WithInjected, CollectedEvent } from '../../types';
import { styled } from '../../styles';
import { useHotkeys, isEditable } from '../../util/ui';
import { debounceComputed } from '../../util/observable';

import { UiStore } from '../../model/ui-store';
import { ProxyStore } from '../../model/proxy-store';
import { EventsStore } from '../../model/http/events-store';
import { HttpExchange } from '../../model/http/exchange';
import { FilterSet } from '../../model/filters/search-filters';

import { SplitPane } from '../split-pane';
import { EmptyState } from '../common/empty-state';

import { ViewEventList } from './view-event-list';
import { ViewEventListFooter } from './view-event-list-footer';
import { ExchangeDetailsPane } from './exchange-details-pane';
import { TlsFailureDetailsPane } from './tls-failure-details-pane';
import { ThemedSelfSizedEditor, SelfSizedBaseEditor } from '../editor/base-editor';

interface ViewPageProps {
    className?: string;
    eventsStore: EventsStore;
    proxyStore: ProxyStore;
    uiStore: UiStore;
    navigate: (path: string) => void;
    eventId?: string;
}

const ViewPageKeyboardShortcuts = (props: {
    selectedEvent: CollectedEvent | undefined,
    moveSelection: (distance: number) => void,
    onPin: (event: HttpExchange) => void,
    onDelete: (event: CollectedEvent) => void,
    onClear: () => void,
    onStartSearch: () => void
}) => {
    useHotkeys('j', (event) => {
        if (isEditable(event.target)) return;
        props.moveSelection(1);
    }, [props.moveSelection]);

    useHotkeys('k', (event) => {
        if (isEditable(event.target)) return;
        props.moveSelection(-1);
    }, [props.moveSelection]);

    useHotkeys('Ctrl+p, Cmd+p', (event) => {
        if (props.selectedEvent instanceof HttpExchange) {
            props.onPin(props.selectedEvent);
            event.preventDefault();
        }
    }, [props.selectedEvent, props.onPin]);

    useHotkeys('Ctrl+Delete, Cmd+Delete', (event) => {
        if (isEditable(event.target)) return;

        if (props.selectedEvent) {
            props.onDelete(props.selectedEvent);
        }
    }, [props.selectedEvent, props.onDelete]);

    useHotkeys('Ctrl+Shift+Delete, Cmd+Shift+Delete', (event) => {
        props.onClear();
        event.preventDefault();
    }, [props.onClear]);

    useHotkeys('Ctrl+f, Cmd+f', (event) => {
        props.onStartSearch();
        event.preventDefault();
    }, [props.onStartSearch]);

    return null;
};

@inject('eventsStore')
@inject('proxyStore')
@inject('uiStore')
@observer
class ViewPage extends React.Component<ViewPageProps> {

    requestEditorNode = portals.createHtmlPortalNode<typeof ThemedSelfSizedEditor>();
    responseEditorNode = portals.createHtmlPortalNode<typeof ThemedSelfSizedEditor>();

    requestEditorRef = React.createRef<SelfSizedBaseEditor>();
    responseEditorRef = React.createRef<SelfSizedBaseEditor>();

    searchInputRef = React.createRef<HTMLInputElement>();

    private listRef = React.createRef<ViewEventList>();

    @observable
    private searchFiltersUnderConsideration: FilterSet | undefined;

    get confirmedSearchFilters() {
        return this.props.uiStore.activeFilterSet;
    }

    @debounceComputed(250, { equals: comparer.structural })
    get currentSearchFilters() {
        // While we're considering some search filters, show the result in the view list.
        return this.searchFiltersUnderConsideration ?? this.confirmedSearchFilters;
    }

    @debounceComputed(10) // Debounce slightly - most important for body filtering performance
    get filteredEventState(): {
        filteredEvents: CollectedEvent[],
        filteredEventCount: [filtered: number, fromTotal: number]
    } {
        const { events } = this.props.eventsStore;

        const filteredEvents = (this.currentSearchFilters.length === 0)
            ? events
            : events.filter((event) =>
                this.currentSearchFilters.every((f) => f.matches(event))
            );

        return {
            filteredEvents,
            filteredEventCount: [filteredEvents.length, events.length]
        };
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

        // Every time the selected event changes, reset the editors:
        disposeOnUnmount(this,
            reaction(() => this.selectedEvent, () => {
                [this.requestEditorRef, this.responseEditorRef].forEach((editorRef) => {
                    editorRef.current?.resetUIState();
                });
            })
        );
    }

    render(): JSX.Element {
        const { isPaused, events } = this.props.eventsStore;
        const { certPath } = this.props.proxyStore;

        const { filteredEvents, filteredEventCount } = this.filteredEventState;

        let rightPane: JSX.Element;
        if (!this.selectedEvent) {
            rightPane = <EmptyState icon={['fas', 'arrow-left']}>
                Select an exchange to see the full details.
            </EmptyState>;
        } else if ('request' in this.selectedEvent) {
            rightPane = <ExchangeDetailsPane
                exchange={this.selectedEvent}
                requestEditor={this.requestEditorNode}
                responseEditor={this.responseEditorNode}
                navigate={this.props.navigate}
                onDelete={this.onDelete}
                onScrollToEvent={this.onScrollToCenterEvent}
            />;
        } else {
            rightPane = <TlsFailureDetailsPane
                failure={this.selectedEvent}
                certPath={certPath}
            />;
        }

        return <div className={this.props.className}>
            <ViewPageKeyboardShortcuts
                selectedEvent={this.selectedEvent}
                moveSelection={this.moveSelection}
                onPin={this.onPin}
                onDelete={this.onDelete}
                onClear={this.onForceClear}
                onStartSearch={this.onStartSearch}
            />
            <SplitPane
                split='vertical'
                primary='second'
                defaultSize='50%'
                minSize={300}
                maxSize={-300}
            >
                <LeftPane>
                    <ViewEventListFooter // Footer above the list to ensure correct tab order
                        searchInputRef={this.searchInputRef}
                        allEvents={events}
                        filteredEvents={filteredEvents}
                        filteredCount={filteredEventCount}
                        onFiltersConsidered={this.onSearchFiltersConsidered}
                        onClear={this.onClear}
                        onScrollToEnd={this.onScrollToEnd}
                    />
                    <ViewEventList
                        events={events}
                        filteredEvents={filteredEvents}
                        selectedEvent={this.selectedEvent}
                        isPaused={isPaused}

                        moveSelection={this.moveSelection}
                        onSelected={this.onSelected}

                        ref={this.listRef}
                    />
                </LeftPane>
                { rightPane }
            </SplitPane>

            {[this.requestEditorNode, this.responseEditorNode].map((editorNode, i) =>
                <portals.InPortal key={i} node={editorNode}>
                    <ThemedSelfSizedEditor
                        ref={i === 0 ? this.requestEditorRef : this.responseEditorRef}
                    />
                </portals.InPortal>
            )}
        </div>;
    }

    @action.bound
    onSearchFiltersConsidered(filters: FilterSet | undefined) {
        this.searchFiltersUnderConsideration = filters;
    }

    @action.bound
    onSelected(event: CollectedEvent | undefined) {
        this.props.navigate(event
            ? `/view/${event.id}`
            : '/view'
        );
    }

    @action.bound
    moveSelection(distance: number) {
        const { filteredEvents } = this.filteredEventState;

        if (filteredEvents.length === 0) return;

        const currentIndex = this.selectedEvent
            ? _.findIndex(filteredEvents, { id: this.selectedEvent.id })
            : -1;

        const targetIndex = (currentIndex === -1)
            ? (distance >= 0 ? 0 : filteredEvents.length - 1) // Jump to the start or end
            : _.clamp(  // Move, but clamped to valid values
                currentIndex + distance,
                0,
                filteredEvents.length - 1
            );

        const targetEvent = filteredEvents[targetIndex];
        this.onSelected(targetEvent);
        this.onScrollToEvent(targetEvent);
    }

    @action.bound
    onPin(event: HttpExchange) {
        event.pinned = !event.pinned;
    }

    @action.bound
    onDelete(event: CollectedEvent) {
        const { filteredEvents } = this.filteredEventState;

        // Prompt before deleting pinned events:
        if (event.pinned && !confirm("Delete this pinned exchange?")) return;

        const rowIndex = filteredEvents.indexOf(event);
        const wasSelected = event === this.selectedEvent;

        // If you delete the selected event, select the next event in the list
        if (rowIndex !== -1 && wasSelected && filteredEvents.length > 0) {
            // Because navigate is async, we can't delete & change selection together.
            // Instead, we update the selection now, and delete the event later.
            const nextEvent = filteredEvents[
                Math.min(rowIndex + 1, filteredEvents.length - 1)
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
    onForceClear() {
        this.onClear(false);
    }

    @action.bound
    onClear(confirmRequired = true) {
        const { events } = this.props.eventsStore;
        const someEventsPinned = _.some(events, { pinned: true });
        const allEventsPinned = events.length > 0 &&
            _.every(events, { pinned: true });

        if (allEventsPinned) {
            // We always confirm deletion of pinned exchanges:
            const confirmResult = confirm("Delete pinned traffic?");
            if (!confirmResult) return;
        } else if (confirmRequired && events.length > 0) {
            // We confirm deletion of non-pinned exchanges when triggered from the
            // button, but not from keyboard shortcuts (which set confirmRequired=false).
            const confirmResult = confirm(
                someEventsPinned
                    ? "Delete all non-pinned traffic?"
                    : "Delete all collected traffic?"
            );
            if (!confirmResult) return;
        }

        this.props.eventsStore.clearInterceptedData(allEventsPinned);
    }

    @action.bound
    onStartSearch() {
        this.searchInputRef.current?.focus();
    }

    @action.bound
    onScrollToEvent(event: CollectedEvent) {
        this.listRef.current?.scrollToEvent(event);
    }

    @action.bound
    onScrollToCenterEvent(event: CollectedEvent) {
        this.listRef.current?.scrollToCenterEvent(event);
    }

    @action.bound
    onScrollToEnd() {
        this.listRef.current?.scrollToEnd();
    }
}

const LeftPane = styled.div`
    position: relative;

    height: 100%;
    box-sizing: border-box;

    display: flex;
    flex-direction: column;
`;

const StyledViewPage = styled(
    // Exclude stores etc from the external props, as they're injected
    ViewPage as unknown as WithInjected<typeof ViewPage, 'uiStore' | 'proxyStore' | 'eventsStore' | 'navigate'>
)`
    height: 100vh;
    position: relative;
`;

export { StyledViewPage as ViewPage };