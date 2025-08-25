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

import { WithInjected, CollectedEvent, HttpExchangeView, RawTunnel } from '../../types';
import { NARROW_LAYOUT_BREAKPOINT, styled } from '../../styles';
import { useHotkeys, isEditable, windowSize, AriaCtrlCmd, Ctrl } from '../../util/ui';
import { debounceComputed } from '../../util/observable';
import { UnreachableCheck, unreachableCheck } from '../../util/error';

import { SERVER_SEND_API_SUPPORTED, serverVersion, versionSatisfies } from '../../services/service-versions';

import { ExpandableViewCardKey, UiStore } from '../../model/ui/ui-store';
import { ProxyStore } from '../../model/proxy-store';
import { EventsStore } from '../../model/events/events-store';
import { RulesStore } from '../../model/rules/rules-store';
import { AccountStore } from '../../model/account/account-store';
import { SendStore } from '../../model/send/send-store';
import { HttpExchange } from '../../model/http/http-exchange';
import { FilterSet } from '../../model/filters/search-filters';
import { buildRuleFromExchange } from '../../model/rules/rule-creation';

import { SplitPane } from '../split-pane';
import { EmptyState } from '../common/empty-state';
import { SelfSizedEditor } from '../editor/base-editor';

import { ViewEventList } from './view-event-list';
import { ViewEventListFooter } from './view-event-list-footer';
import { ViewEventContextMenuBuilder } from './view-context-menu-builder';
import { PaneOuterContainer } from './view-details-pane';
import { HttpDetailsPane } from './http/http-details-pane';
import { TlsFailureDetailsPane } from './tls/tls-failure-details-pane';
import { TlsTunnelDetailsPane } from './tls/tls-tunnel-details-pane';
import { RTCDataChannelDetailsPane } from './rtc/rtc-data-channel-details-pane';
import { RTCMediaDetailsPane } from './rtc/rtc-media-details-pane';
import { RTCConnectionDetailsPane } from './rtc/rtc-connection-details-pane';
import { RawTunnelDetailsPane } from './raw-tunnel-details-pane';

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
    isPaidUser: boolean,
    selectedEvent: CollectedEvent | undefined,
    onFocusLeft: () => void,
    onFocusRight: () => void,
    moveSelection: (distance: number) => void,
    onPin: (event: HttpExchange) => void,
    onResend: (event: HttpExchange) => void,
    onBuildRuleFromExchange: (event: HttpExchange) => void,
    onDelete: (event: CollectedEvent) => void,
    onClear: () => void,
    onStartSearch: () => void
}) => {
    const selectedEvent = props.selectedEvent;

    useHotkeys('Ctrl+[, Cmd+[', (event) => {
        event.preventDefault();
        props.onFocusLeft();
    }, [props.onFocusLeft]);

    useHotkeys('Ctrl+], Cmd+]', (event) => {
        event.preventDefault();
        props.onFocusRight();
    }, [props.onFocusRight]);

    useHotkeys('j', (event) => {
        if (isEditable(event.target)) return;
        props.moveSelection(1);
    }, [props.moveSelection]);

    useHotkeys('k', (event) => {
        if (isEditable(event.target)) return;
        props.moveSelection(-1);
    }, [props.moveSelection]);

    useHotkeys('Ctrl+p, Cmd+p', (event) => {
        if (selectedEvent?.isHttp()) {
            props.onPin(selectedEvent);
            event.preventDefault();
        }
    }, [selectedEvent, props.onPin]);

    useHotkeys('Ctrl+r, Cmd+r', (event) => {
        if (props.isPaidUser && selectedEvent?.isHttp() && !selectedEvent?.isWebSocket()) {
            props.onResend(selectedEvent);
            event.preventDefault();
        }
    }, [selectedEvent, props.onResend, props.isPaidUser]);

    useHotkeys('Ctrl+m, Cmd+m', (event) => {
        if (props.isPaidUser && selectedEvent?.isHttp() && !selectedEvent?.isWebSocket()) {
            props.onBuildRuleFromExchange(selectedEvent);
            event.preventDefault();
        }
    }, [selectedEvent, props.onBuildRuleFromExchange, props.isPaidUser]);

    useHotkeys('Ctrl+Delete, Cmd+Delete, Ctrl+Backspace, Cmd+Backspace', (event) => {
        if (isEditable(event.target)) return;

        if (selectedEvent) {
            props.onDelete(selectedEvent);
        }
    }, [selectedEvent, props.onDelete]);

    useHotkeys('Ctrl+Shift+Delete, Cmd+Shift+Delete, Ctrl+Shift+Backspace, Cmd+Shift+Backspace', (event) => {
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

const paneExpansionRequirements: { [key in ExpandableViewCardKey]: (event: CollectedEvent) => boolean } = {
    requestBody: (event: CollectedEvent) =>
        event.isHttp() &&
        (event.hasRequestBody() || !!event.downstream.requestBreakpoint),
    responseBody: (event: CollectedEvent) =>
        event.isHttp() &&
        (event.hasResponseBody() || !!event.downstream.responseBreakpoint),
    webSocketMessages: (event: CollectedEvent) =>
        event.isWebSocket() && event.wasAccepted,
    rawTunnelPackets: (event: CollectedEvent) =>
        event.isRawTunnel()
};

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
    private splitPaneRef = React.createRef<SplitPane>();

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
        filteredEvents: ReadonlyArray<CollectedEvent>,
        filteredEventCount: [filtered: number, fromTotal: number]
    } {
        const { events } = this.props.eventsStore;

        const filteredEvents = (this.currentSearchFilters.length === 0)
            ? events
            : events.filter((event) => {
                if (event.isHttp() && event.wasTransformed) {
                    return this.currentSearchFilters.every((f) => f.matches(event.downstream) || f.matches(event.upstream!))
                } else {
                    return this.currentSearchFilters.every((f) => f.matches(event))
                }
            });

        return {
            filteredEvents,
            filteredEventCount: [filteredEvents.length, events.length]
        };
    }
    @computed
    get selectedEvent() {
        // First try to use the URL-based eventId, then fallback to the persisted selection
        const targetEventId = this.props.eventId || this.props.uiStore.selectedEventId;

        return _.find(this.props.eventsStore.events, {
            id: targetEventId
        });
    }

    @computed
    get selectedExchange() {
        const { contentPerspective } = this.props.uiStore;
        if (!this.selectedEvent) return undefined;
        if (!this.selectedEvent.isHttp()) return undefined;

        return contentPerspective === 'client'
            ? this.selectedEvent.downstream
            : contentPerspective === 'server'
                ? (this.selectedEvent.upstream ?? this.selectedEvent.downstream)
                : contentPerspective === 'original'
                    ? this.selectedEvent.original
                    : contentPerspective === 'transformed'
                        ? this.selectedEvent.transformed
                        : unreachableCheck(contentPerspective)
    }

    private readonly contextMenuBuilder = new ViewEventContextMenuBuilder(
        this.props.accountStore,
        this.props.uiStore,
        this.onPin,
        this.onDelete,
        this.onBuildRuleFromExchange,
        this.onPrepareToResendRequest,
        this.onHeaderColumnOptionChange
    );

    componentDidMount() {
        // After first render, if we're jumping to an event, then scroll to it:
        requestAnimationFrame(() => {
            if (this.props.eventId && this.selectedEvent) {
                this.props.uiStore.setSelectedEventId(this.props.eventId);
                this.onScrollToCenterEvent(this.selectedEvent);
            }
        });

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
            if (expandedViewCard) {
                // If you have a pane expanded, and select an event with no data
                // for that pane, then disable the expansion:
                if (!paneExpansionRequirements[expandedViewCard](selectedEvent)) {
                    runInAction(() => {
                        this.props.uiStore.expandedViewCard = undefined;
                    });
                }
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
                    (oldFilteredEvents as CollectedEvent[]).length = 0;
                }
            })
        );
    }

    componentDidUpdate(prevProps: ViewPageProps) {
        // Only clear persisted selection if we're explicitly navigating to a different event via URL
        // Don't clear it when going from eventId to no eventId (which happens when clearing selection)
        if (this.props.eventId && prevProps.eventId && this.props.eventId !== prevProps.eventId) {
            // Clear persisted selection only when explicitly navigating between different events via URL
            this.props.uiStore.setSelectedEventId(undefined);
        }
    }

    isSendAvailable() {
        return versionSatisfies(serverVersion.value as string, SERVER_SEND_API_SUPPORTED);
    }

    render(): JSX.Element {
        const { isPaused, events } = this.props.eventsStore;
        const { certPath } = this.props.proxyStore;
        const { isPaidUser } = this.props.accountStore;

        const { filteredEvents, filteredEventCount } = this.filteredEventState;

        let rightPane: JSX.Element | null;
        if (!this.selectedEvent) {
            if (this.splitDirection === 'vertical') {
                rightPane = <EmptyState key='details' icon='ArrowLeft'>
                    Select an exchange to see the full details.
                </EmptyState>;
            } else {
                rightPane = null;
            }
        } else if (this.selectedEvent.isHttp()) {
            rightPane = <HttpDetailsPane
                exchange={this.selectedExchange!}
                perspective={this.props.uiStore.contentPerspective}

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
        } else if (this.selectedEvent.isRawTunnel()) {
            rightPane = <RawTunnelDetailsPane
                tunnel={this.selectedEvent}
                streamMessageEditor={this.editors.streamMessage}
                isPaidUser={isPaidUser}
            />
        } else {
            throw new UnreachableCheck(this.selectedEvent);
        }

        const minSize = this.splitDirection === 'vertical'
            ? 300
            : 200;

        return <div className={this.props.className}>
            <ViewPageKeyboardShortcuts
                isPaidUser={isPaidUser}
                selectedEvent={this.selectedEvent}
                moveSelection={this.moveSelection}
                onFocusLeft={this.focusLeftPane}
                onFocusRight={this.focusRightPane}
                onPin={this.onPin}
                onResend={this.onPrepareToResendRequest}
                onBuildRuleFromExchange={this.onBuildRuleFromExchange}
                onDelete={this.onDelete}
                onClear={this.onForceClear}
                onStartSearch={this.onStartSearch}
            />

            <SplitPane
                ref={this.splitPaneRef}
                split={this.splitDirection}
                primary='second'
                defaultSize='50%'
                minSize={minSize}
                maxSize={-minSize}
                hiddenPane={rightPane === null ? '2' : undefined}
            >
                <LeftPane
                    aria-label='The collected events list pane'
                    aria-keyshortcuts={`${AriaCtrlCmd}+[`}
                >
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
                        uiStore={this.props.uiStore}

                        ref={this.listRef}
                    />
                </LeftPane>
                <PaneOuterContainer
                    aria-label='The selected event details pane'
                    aria-keyshortcuts={`${AriaCtrlCmd}+]`}
                >
                    { rightPane }
                </PaneOuterContainer>
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

    focusLeftPane = () => {
        this.listRef.current?.focusList();
    };

    focusRightPane = () => {
        const rightPane = this.splitPaneRef.current?.pane2;
        const firstFocusableElem = rightPane?.querySelector(
            '[tabindex]:not([tabindex="-1"])'
        ) as HTMLElement | null;

        firstFocusableElem?.focus();
    };

    @action.bound
    onSearchFiltersConsidered(filters: FilterSet | undefined) {
        this.searchFiltersUnderConsideration = filters;
    }

    @action.bound
    onSelected(event: CollectedEvent | undefined) {
        this.props.uiStore.setSelectedEventId(event?.id);

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
    onBuildRuleFromExchange(exchange: HttpExchangeView) {
        const { rulesStore, navigate } = this.props;

        if (!this.props.accountStore!.isPaidUser) return;

        const rule = buildRuleFromExchange(exchange);
        rulesStore!.draftRules.items.unshift(rule);
        navigate(`/modify/${rule.id}`);
    }

    @action.bound
    async onPrepareToResendRequest(exchange: HttpExchangeView) {
        const { sendStore, navigate } = this.props;

        if (!this.props.accountStore!.isPaidUser) return;

        await sendStore.addRequestInputFromExchange(exchange);
        navigate(`/send`);
    }

    @action.bound
    async onHeaderColumnOptionChange(visibleViewColumns: Map<string, boolean>, columnName: string, show: boolean) {
        visibleViewColumns.set(columnName, show);
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
        const someEventsPinned = events.some(e => e.pinned === true);
        const allEventsPinned = events.length > 0 &&
            events.every(e => e.pinned === true);

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