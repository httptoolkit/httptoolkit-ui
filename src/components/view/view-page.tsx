import * as React from 'react';
import * as _ from 'lodash';
import {
    observable,
    autorun,
    action,
    computed,
    runInAction,
    comparer,
    observe
} from 'mobx';
import { observer, disposeOnUnmount, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { WithInjected, CollectedEvent, HttpExchangeView } from '../../types';
import { NARROW_LAYOUT_BREAKPOINT, styled } from '../../styles';
import { useHotkeys, isEditable, windowSize, AriaCtrlCmd } from '../../util/ui';
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
import { Filter, FilterSet } from '../../model/filters/search-filters';
import * as uuid from 'uuid/v4';
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
import { MultiSelectionSummaryPane } from './multi-selection-summary-pane';

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
    isMultiSelection: boolean,
    onFocusLeft: () => void,
    onFocusRight: () => void,
    moveSelection: (distance: number) => void,
    onPin: () => void,
    onResend: (event: HttpExchange) => void,
    onBuildRule: () => void,
    onDelete: () => void,
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
        if (selectedEvent || props.isMultiSelection) {
            props.onPin();
            event.preventDefault();
        }
    }, [selectedEvent, props.isMultiSelection, props.onPin]);

    useHotkeys('Ctrl+r, Cmd+r', (event) => {
        if (props.isPaidUser && selectedEvent?.isHttp() && !selectedEvent?.isWebSocket()) {
            props.onResend(selectedEvent);
            event.preventDefault();
        }
    }, [selectedEvent, props.onResend, props.isPaidUser]);

    useHotkeys('Ctrl+m, Cmd+m', (event) => {
        if (props.isPaidUser && (selectedEvent?.isHttp() || props.isMultiSelection)) {
            props.onBuildRule();
            event.preventDefault();
        }
    }, [selectedEvent, props.isMultiSelection, props.onBuildRule, props.isPaidUser]);

    useHotkeys('Ctrl+Delete, Cmd+Delete, Ctrl+Backspace, Cmd+Backspace', (event) => {
        if (isEditable(event.target)) return;
        if (selectedEvent || props.isMultiSelection) {
            props.onDelete();
        }
    }, [selectedEvent, props.isMultiSelection, props.onDelete]);

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

    @observable
    private selectionAnchorId: string | undefined;

    // Snapshot of selection before a shift operation began, so shift+arrow
    // can grow/shrink the range without losing prior ctrl+click selections.
    private selectionBaseIds: ReadonlySet<string> | undefined;

    @computed
    get selectedEvent(): CollectedEvent | undefined {
        // Show details only when exactly one event is selected
        const { selectedEventIds } = this.props.uiStore;
        if (selectedEventIds.size !== 1) return undefined;

        const id = selectedEventIds.values().next().value as string;
        return this.props.eventsStore.eventsList.getById(id);
    }

    @computed
    get isMultiSelection(): boolean {
        return this.props.uiStore.selectedEventIds.size > 1;
    }

    @computed
    get isRightPaneVisible(): boolean {
        return this.isMultiSelection || this.selectedEvent !== undefined;
    }

    @computed
    get selectedEvents(): ReadonlyArray<CollectedEvent> {
        const { selectedEventIds } = this.props.uiStore;
        if (selectedEventIds.size === 0) return [];

        // This gives us the events in selection order - nice for UX later
        const { eventsList } = this.props.eventsStore;
        const result: CollectedEvent[] = [];
        for (const id of selectedEventIds) {
            const event = eventsList.getById(id);
            if (event) result.push(event);
        }
        return result;
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
        () => this.selectedEvents,
        {
            onPin: this.onPin,
            onDelete: this.onDelete,
            onDeleteSelection: this.onDeleteSelection,
            onBuildRuleFromExchange: this.onBuildRuleFromExchange,
            onBuildRuleFromSelectedExchanges: this.onBuildRuleFromSelectedExchanges,
            onPrepareToResendRequest: this.onPrepareToResendRequest,
            onAddFilter: this.onAddSearchFilter
        }
    );

    componentDidMount() {
        requestAnimationFrame(() => {
            // If we're arriving via deep link (/view/:eventId), sync store from URL
            if (this.props.eventId) {
                this.props.uiStore.selectSingleEvent(this.props.eventId);
                this.selectionAnchorId = this.props.eventId;
                if (this.selectedEvent) {
                    this.onScrollToEvent(this.selectedEvent);
                }
            }

            this.listRef.current?.focusListWindow();
        });

        disposeOnUnmount(this, observe(this, 'isRightPaneVisible', ({ oldValue, newValue }) => {
            if (this.splitDirection !== 'horizontal') return;

            // In horizontal mode, the details pane appears and disappears, so we need to do some
            // tricks to stop the scroll position in the list doing confusing things.

            if (!oldValue && newValue) {
                // If we're bringing the details pane into view, we want to jump to where we were
                // but then shift slightly to make sure the active row is visible too.
                setTimeout(() => {
                    const activeId = this.props.uiStore.activeEventId;
                    if (!activeId) return;
                    const activeEvent = this.props.eventsStore.eventsList.getById(activeId);
                    if (activeEvent) {
                        this.listRef.current?.scrollToEvent(activeEvent);
                    }
                }, 50); // We need to delay slightly to let DOM and then UI state catch up
            }
        }));

        disposeOnUnmount(this, autorun(() => {
            if (this.props.uiStore.selectedEventIds.size === 0) return;
            const selectedEvent = this.selectedEvent;

            // If you somehow have a non-existent event selected, unselect it
            if (!selectedEvent && this.props.uiStore.selectedEventIds.size === 1) {
                this.onSelected(undefined);
                return;
            }

            const { expandedViewCard } = this.props.uiStore;
            if (expandedViewCard && selectedEvent) {
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
        // When the URL-based event changes (e.g. back/forward navigation, deep link),
        // sync the selection to match, but only if it doesn't already match (to avoid
        // redundant updates when our own onSelected triggered the navigation).
        if (this.props.eventId && this.props.eventId !== prevProps.eventId) {
            if (!this.props.uiStore.selectedEventIds.has(this.props.eventId)) {
                this.props.uiStore.selectSingleEvent(this.props.eventId);
                this.selectionAnchorId = this.props.eventId;
            }
        }
    }

    isSendAvailable() {
        return versionSatisfies(serverVersion.value as string, SERVER_SEND_API_SUPPORTED);
    }

    render(): JSX.Element {
        const { isPaused, events } = this.props.eventsStore;
        const { certPath } = this.props.proxyStore;
        const isPaidUser = this.props.accountStore.user.isPaidUser();

        const { filteredEvents, filteredEventCount } = this.filteredEventState;

        let rightPane: JSX.Element | null;
        if (this.isMultiSelection) {
            rightPane = <MultiSelectionSummaryPane
                selectedEvents={this.selectedEvents}
            />;
        } else if (!this.selectedEvent) {
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
                isMultiSelection={this.isMultiSelection}
                moveSelection={this.moveSelection}
                onFocusLeft={this.focusLeftPane}
                onFocusRight={this.focusRightPane}
                onPin={this.onPin}
                onResend={this.onPrepareToResendRequest}
                onBuildRule={this.onBuildRuleFromSelectedExchanges}
                onDelete={this.onDeleteSelection}
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
                        selectedEventIds={this.props.uiStore.selectedEventIds}
                        activeEventId={this.props.uiStore.activeEventId}
                        isPaused={isPaused}

                        moveSelection={this.moveSelection}
                        onSelected={this.onSelected}
                        onToggleSelected={this.onToggleSelected}
                        onRangeSelected={this.onRangeSelected}
                        onSelectAll={this.onSelectAll}
                        onClearSelection={this.onClearSelection}
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
    onAddSearchFilter(filter: Filter) {
        if (this.searchFiltersUnderConsideration) {
            this.searchFiltersUnderConsideration = [
                this.searchFiltersUnderConsideration[0],
                filter,
                ...this.searchFiltersUnderConsideration.slice(1)
            ];
        }

        this.props.uiStore.activeFilterSet = [
            this.props.uiStore.activeFilterSet[0],
            filter,
            ...this.props.uiStore.activeFilterSet.slice(1)
        ]
    }

    @action.bound
    onSelected(event: CollectedEvent | undefined) {
        this.selectionBaseIds = undefined;
        this.props.uiStore.selectSingleEvent(event?.id);
        this.selectionAnchorId = event?.id;

        // Update URL for back/forward navigation, but only when selecting
        // (not deselecting) to avoid /view → /view/:id route-pattern changes
        // that cause remounts
        if (event) {
            this.props.navigate(`/view/${event.id}`);
        }
    }

    @action.bound
    onToggleSelected(event: CollectedEvent) {
        this.selectionBaseIds = undefined;
        this.props.uiStore.toggleEventSelection(event.id);
        this.selectionAnchorId = event.id;
    }

    @action.bound
    onRangeSelected(targetEvent: CollectedEvent) {
        if (this.extendSelectionTo(targetEvent)) {
            this.onScrollToEvent(targetEvent);
        } else {
            // No anchor — fall back to single-select
            this.onSelected(targetEvent);
        }
    }

    private extendSelectionTo(targetEvent: CollectedEvent): boolean {
        const { filteredEvents } = this.filteredEventState;

        const anchorIndex = this.selectionAnchorId
            ? filteredEvents.findIndex(e => e.id === this.selectionAnchorId)
            : -1;
        const targetIndex = filteredEvents.findIndex(e => e.id === targetEvent.id);

        if (anchorIndex === -1 || targetIndex === -1) return false;

        // Capture base selection on first shift operation, so the range can
        // grow/shrink without losing prior ctrl+click selections.
        if (!this.selectionBaseIds) {
            this.selectionBaseIds = new Set(this.props.uiStore.selectedEventIds);
        }

        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        const rangeIds = filteredEvents.slice(start, end + 1).map(e => e.id);

        // Order range from anchor toward target, so items are in the order
        // they were conceptually added (anchor end first, target end last).
        if (targetIndex < anchorIndex) rangeIds.reverse();

        // Union of base + range, with target last (most recently interacted).
        // Filter target from both to avoid Set dedup keeping it at an earlier position.
        const targetId = targetEvent.id;
        const unionIds: string[] = [];
        for (const id of this.selectionBaseIds) {
            if (id !== targetId) unionIds.push(id);
        }
        for (const id of rangeIds) {
            if (id !== targetId) unionIds.push(id);
        }
        unionIds.push(targetId);
        this.props.uiStore.selectEventRange(unionIds, targetId);
        return true;
    }

    @action.bound
    onSelectAll() {
        this.selectionBaseIds = undefined;
        const { filteredEvents } = this.filteredEventState;
        this.props.uiStore.selectAllEvents(filteredEvents.map(e => e.id));
    }

    @action.bound
    onClearSelection() {
        this.selectionBaseIds = undefined;
        this.props.uiStore.clearSelection();
        this.selectionAnchorId = undefined;
    }

    private lastActiveIndex: number = -1;

    @action.bound
    moveSelection(distance: number, extend: boolean = false) {
        const { filteredEvents } = this.filteredEventState;

        if (filteredEvents.length === 0) return;

        const { activeEventId } = this.props.uiStore;
        let currentIndex: number;
        if (!activeEventId) {
            currentIndex = -1;
        } else if (
            this.lastActiveIndex >= 0 &&
            this.lastActiveIndex < filteredEvents.length &&
            filteredEvents[this.lastActiveIndex].id === activeEventId
        ) {
            // Optimize for the case where you move repeatedly within the same
            // filtered list, and avoid rescanning the whole thing if our last index
            // already matches. Makes up + up + up much quicker.
            currentIndex = this.lastActiveIndex;
        } else {
            currentIndex = _.findIndex(filteredEvents, { id: activeEventId });
        }

        const targetIndex = (currentIndex === -1)
            ? (distance >= 0 ? 0 : filteredEvents.length - 1) // Jump to the start or end
            : _.clamp(  // Move, but clamped to valid values
                currentIndex + distance,
                0,
                filteredEvents.length - 1
            );

        const targetEvent = filteredEvents[targetIndex];
        this.lastActiveIndex = targetIndex;

        if (extend) {
            this.extendSelectionTo(targetEvent);
        } else {
            this.selectionBaseIds = undefined;
            this.onSelected(targetEvent);
        }

        this.onScrollToEvent(targetEvent);
    }

    @action.bound
    onPin() {
        const events = this.selectedEvents;
        if (events.length === 0) return;

        // If any are unpinned, pin all. If all pinned, unpin all.
        const shouldPin = events.some(e => !e.pinned);
        for (const event of events) {
            event.pinned = shouldPin;
        }
    }

    @action.bound
    onBuildRuleFromExchange(exchange: HttpExchangeView) {
        const { rulesStore, navigate } = this.props;

        if (!this.props.accountStore!.user.isPaidUser()) return;

        const rule = buildRuleFromExchange(exchange);
        rulesStore!.draftRules.items.unshift(rule);
        navigate(`/modify/${rule.id}`);
    }

    @action.bound
    onBuildRuleFromSelectedExchanges() {
        const { rulesStore, navigate } = this.props;

        if (!this.props.accountStore!.user.isPaidUser()) return;

        const exchanges = this.selectedEvents
            .filter((e): e is HttpExchange => e.isHttp() && !e.isWebSocket());
        if (exchanges.length === 0) return;

        if (exchanges.length === 1) {
            // Single exchange — create a single rule
            const rule = buildRuleFromExchange(exchanges[0]);
            rulesStore!.draftRules.items.unshift(rule);
            navigate(`/modify/${rule.id}`);
        } else {
            // Multiple exchanges — create a rule group
            const group = {
                id: uuid(),
                title: `Rules from ${exchanges.length} requests`,
                items: exchanges.map(e => buildRuleFromExchange(e))
            };
            rulesStore!.draftRules.items.unshift(group);
            navigate(`/modify/${group.id}`);
        }
    }

    @action.bound
    async onPrepareToResendRequest(exchange: HttpExchangeView) {
        const { sendStore, navigate } = this.props;

        if (!this.props.accountStore!.user.isPaidUser()) return;

        await sendStore.addRequestInputFromExchange(exchange);
        navigate(`/send`);
    }

    @action.bound
    onDelete(event: CollectedEvent) {
        const { filteredEvents } = this.filteredEventState;

        // Prompt before deleting pinned events:
        if (event.pinned && !confirm("Delete this pinned exchange?")) return;

        const rowIndex = filteredEvents.indexOf(event);
        const wasSelected = event === this.selectedEvent;

        // Remove from selection set
        this.props.uiStore.selectedEventIds.delete(event.id);

        // If you delete the selected event, select the next event in the list
        if (rowIndex !== -1 && wasSelected && filteredEvents.length > 0) {
            const nextEvent = filteredEvents[
                Math.min(rowIndex + 1, filteredEvents.length - 1)
            ];
            this.onSelected(nextEvent);
        }

        this.props.eventsStore.deleteEvent(event);
    }

    @action.bound
    onDeleteSelection() {
        if (this.isMultiSelection) {
            const events = [...this.selectedEvents];
            if (events.length === 0) return;

            const hasPinned = events.some(e => e.pinned);
            if (hasPinned && !confirm(`Delete ${events.length} events including pinned?`)) return;

            this.onClearSelection();
            for (const event of events) {
                this.props.eventsStore.deleteEvent(event);
            }
        } else if (this.selectedEvent) {
            this.onDelete(this.selectedEvent);
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

        this.props.uiStore.clearSelection();
        this.selectionAnchorId = undefined;
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