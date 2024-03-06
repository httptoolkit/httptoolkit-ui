import * as React from 'react';
import * as _ from 'lodash';
import {
    observable,
    autorun,
    action,
    computed,
    runInAction,
    when,
    comparer,
    observe
} from 'mobx';
import { observer, disposeOnUnmount, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { WithInjected, CollectedEvent } from '../../types';
import { NARROW_LAYOUT_BREAKPOINT, styled } from '../../styles';
import { useHotkeys, isEditable, windowSize } from '../../util/ui';
import { debounceComputed } from '../../util/observable';
import { UnreachableCheck } from '../../util/error';

import { SERVER_SEND_API_SUPPORTED, serverVersion, versionSatisfies } from '../../services/service-versions';

import { UiStore } from '../../model/ui/ui-store';
import { ProxyStore } from '../../model/proxy-store';
import { EventsStore } from '../../model/events/events-store';
import { RulesStore } from '../../model/rules/rules-store';
import { AccountStore } from '../../model/account/account-store';
import { SendStore } from '../../model/send/send-store';
import { HttpExchange } from '../../model/http/exchange';
import { FilterSet } from '../../model/filters/search-filters';
import { buildRuleFromExchange } from '../../model/rules/rule-creation';
import { buildRequestInputFromExchange } from '../../model/send/send-request-model';

import { SplitPane } from '../split-pane';
import { EmptyState } from '../common/empty-state';
import { SelfSizedEditor } from '../editor/base-editor';

import { ViewEventList } from './view-event-list';
import { ViewEventListFooter } from './view-event-list-footer';
import { ViewEventContextMenuBuilder } from './view-context-menu-builder';
import { HttpDetailsPane } from './http/http-details-pane';
import { TlsFailureDetailsPane } from './tls/tls-failure-details-pane';
import { TlsTunnelDetailsPane } from './tls/tls-tunnel-details-pane';
import { RTCDataChannelDetailsPane } from './rtc/rtc-data-channel-details-pane';
import { RTCMediaDetailsPane } from './rtc/rtc-media-details-pane';
import { RTCConnectionDetailsPane } from './rtc/rtc-connection-details-pane';

interface ViewPageProps {
    className?: string;
    eventsStore: EventsStore;
    proxyStore: ProxyStore;
    uiStore: UiStore;
    accountStore: AccountStore;
    rulesStore: RulesStore;
    sendStore: SendStore;
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
        if (props.selectedEvent?.isHttp()) {
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

const EDITOR_KEYS = [
    'request',
    'response',
    'streamMessage'
] as const;
type EditorKey = typeof EDITOR_KEYS[number];

@inject('eventsStore')
@inject('proxyStore')
@inject('uiStore')
@inject('accountStore')
@inject('rulesStore')
@inject('sendStore')
@observer
class ViewPage extends React.Component<ViewPageProps> {

    @computed
    private get splitDirection(): 'vertical' | 'horizontal' {
        if (windowSize.width >= NARROW_LAYOUT_BREAKPOINT) {
            return 'vertical';
        } else {
            return 'horizontal';
        }
    }

    private readonly editors = EDITOR_KEYS.reduce((v, key) => ({
        ...v,
        [key]: portals.createHtmlPortalNode<typeof SelfSizedEditor>()
    }), {} as {
        [K in EditorKey]: portals.HtmlPortalNode<typeof SelfSizedEditor>
    });

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

    private readonly contextMenuBuilder = new ViewEventContextMenuBuilder(
        this.props.accountStore,
        this.props.uiStore,
        this.onPin,
        this.onDelete,
        this.onBuildRuleFromExchange,
        this.onPrepareToResendRequest
    );

    componentDidMount() {
        disposeOnUnmount(this, observe(this, 'selectedEvent', ({ oldValue, newValue }) => {
            if (this.splitDirection !== 'horizontal') return;

            // In horizontal mode, the details pane appears and disappears, so we need to do some
            // tricks to stop the scroll position in the list doing confusing things.

            if (!oldValue && newValue) {
                // If we're bringing the details pane into view, we want to jump to where we were
                // but then shift slightly to make sure the selected row is visible too.
                setTimeout(() => {
                    if (!this.selectedEvent) return;
                    this.listRef.current?.scrollToEvent(this.selectedEvent);
                }, 50); // We need to delay slightly to let DOM and then UI state catch up
            }
        }));

        disposeOnUnmount(this, autorun(() => {
            if (!this.props.eventId) return;
            const selectedEvent = this.selectedEvent;

            // If you somehow have a non-existent event selected, unselect it
            if (!selectedEvent) {
                this.onSelected(undefined);
                return;
            }

            const { expandedViewCard } = this.props.uiStore;

            if (!expandedViewCard) return;

            // If you have a pane expanded, and select an event with no data
            // for that pane, then disable the expansion
            if (
                !(selectedEvent.isHttp()) ||
                (
                    expandedViewCard === 'requestBody' &&
                    !selectedEvent.hasRequestBody() &&
                    !selectedEvent.requestBreakpoint
                ) ||
                (
                    expandedViewCard === 'responseBody' &&
                    !selectedEvent.hasResponseBody() &&
                    !selectedEvent.responseBreakpoint
                ) ||
                (
                    expandedViewCard === 'webSocketMessages' &&
                    !(selectedEvent.isWebSocket() && selectedEvent.wasAccepted())
                )
            ) {
                runInAction(() => {
                    this.props.uiStore.expandedViewCard = undefined;
                });
                return;
            }
        }));

        // Due to https://github.com/facebook/react/issues/16087 in React, which is fundamentally caused by
        // https://bugs.chromium.org/p/chromium/issues/detail?id=1218275 in Chrome, we can leak filtered event
        // list references, which means that HTTP exchanges persist in memory even after they're cleared.
        // This observer ensures that the persisted array reference is always emptied after a new value appears:
        disposeOnUnmount(this,
            observe(this, 'filteredEventState', ({ newValue, oldValue }) => {
                const newFilteredEvents = newValue.filteredEvents;
                const oldFilteredEvents = oldValue?.filteredEvents;

                if (
                    oldFilteredEvents &&
                    oldFilteredEvents !== newFilteredEvents &&
                    oldFilteredEvents !== this.props.eventsStore.events
                ) {
                    oldFilteredEvents.length = 0;
                }
            })
        );
    }

    isSendAvailable() {
        return this.props.accountStore.featureFlags.includes('send') &&
            versionSatisfies(serverVersion.value as string, SERVER_SEND_API_SUPPORTED);
    }

    render(): JSX.Element {
        const { isPaused, events } = this.props.eventsStore;
        const { certPath } = this.props.proxyStore;

        const { filteredEvents, filteredEventCount } = this.filteredEventState;

        let rightPane: JSX.Element | null;
        if (!this.selectedEvent) {
            if (this.splitDirection === 'vertical') {
                rightPane = <EmptyState key='details' icon={['fas', 'arrow-left']}>
                    Select an exchange to see the full details.
                </EmptyState>;
            } else {
                rightPane = null;
            }
        } else if (this.selectedEvent.isHttp()) {
            rightPane = <HttpDetailsPane
                exchange={this.selectedEvent}

                requestEditor={this.editors.request}
                responseEditor={this.editors.response}
                streamMessageEditor={this.editors.streamMessage}

                navigate={this.props.navigate}
                onDelete={this.onDelete}
                onScrollToEvent={this.onScrollToCenterEvent}
                onBuildRuleFromExchange={this.onBuildRuleFromExchange}
                onPrepareToResendRequest={this.isSendAvailable()
                    // Only show Send if flag is enabled & server is up to date
                    ? this.onPrepareToResendRequest
                    : undefined
                }
            />;
        } else if (this.selectedEvent.isTlsFailure()) {
            rightPane = <TlsFailureDetailsPane
                failure={this.selectedEvent}
                certPath={certPath}
            />;
        } else if (this.selectedEvent.isTlsTunnel()) {
            rightPane = <TlsTunnelDetailsPane
                tunnel={this.selectedEvent}
            />;
        } else if (this.selectedEvent.isRTCDataChannel()) {
            rightPane = <RTCDataChannelDetailsPane
                dataChannel={this.selectedEvent}
                streamMessageEditor={this.editors.streamMessage}
                navigate={this.props.navigate}
            />
        } else if (this.selectedEvent.isRTCMediaTrack()) {
            rightPane = <RTCMediaDetailsPane
                mediaTrack={this.selectedEvent}
                navigate={this.props.navigate}
            />
        } else if (this.selectedEvent.isRTCConnection()) {
            rightPane = <RTCConnectionDetailsPane
                connection={this.selectedEvent}
                offerEditor={this.editors.request}
                answerEditor={this.editors.response}
                navigate={this.props.navigate}
            />
        } else {
            throw new UnreachableCheck(this.selectedEvent);
        }

        const minSize = this.splitDirection === 'vertical'
            ? 300
            : 200;

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
                split={this.splitDirection}
                primary='second'
                defaultSize='50%'
                minSize={minSize}
                maxSize={-minSize}
                hiddenPane={rightPane === null ? '2' : undefined}
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

                        contextMenuBuilder={this.contextMenuBuilder}

                        ref={this.listRef}
                    />
                </LeftPane>
                {
                    rightPane ?? <div />
                    // The <div/> is hidden by hiddenPane, so does nothing, but avoids
                    // a React error in react-split-pane for undefined children
                }
            </SplitPane>

            {Object.values(this.editors).map((node, i) =>
                <portals.InPortal key={i} node={node}>
                    <SelfSizedEditor
                        contentId={null}
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
    onPin(event: CollectedEvent) {
        event.pinned = !event.pinned;
    }

    @action.bound
    onBuildRuleFromExchange(exchange: HttpExchange) {
        const { rulesStore, navigate } = this.props;

        const rule = buildRuleFromExchange(exchange);
        rulesStore!.draftRules.items.unshift(rule);
        navigate(`/mock/${rule.id}`);
    }

    @action.bound
    async onPrepareToResendRequest(exchange: HttpExchange) {
        const { sendStore, navigate } = this.props;
        sendStore.addRequestInput(await buildRequestInputFromExchange(exchange));
        navigate(`/send`);
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
    ViewPage as unknown as WithInjected<typeof ViewPage,
        | 'eventsStore'
        | 'proxyStore'
        | 'uiStore'
        | 'accountStore'
        | 'rulesStore'
        | 'sendStore'
        | 'navigate'
    >
)`
    height: 100vh;
    position: relative;
`;

export { StyledViewPage as ViewPage };