import * as _ from 'lodash';
import * as React from 'react';
import { inject, observer, Observer } from 'mobx-react';
import { action, computed } from 'mobx';

import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';

import { styled } from '../../styles'
import { css } from "styled-components";
import { ArrowIcon, Icon, PhosphorIcon, WarningIcon } from '../../icons';

import {
    CollectedEvent,
    HttpExchange,
    RTCStream,
    FailedTlsConnection,
    RTCConnection,
    TlsTunnel,
    RawTunnel
} from '../../types';
import { UiStore } from '../../model/ui/ui-store';

import {
    getSummaryColor,
    EventCategory,
    describeEventCategory
} from '../../model/events/categorization';
import { nameStepClass } from '../../model/rules/rule-descriptions';
import { getReadableSize } from '../../util/buffer';
import { calculateAndFormatDuration } from "../../util/utils";

import { UnreachableCheck } from '../../util/error';
import { filterProps } from '../component-utils';

import { EmptyState } from '../common/empty-state';
import { StatusCode } from '../common/status-code';

import { HEADER_FOOTER_HEIGHT } from './view-event-list-footer';
import { ViewEventContextMenuBuilder } from './view-context-menu-builder';

const SCROLL_BOTTOM_MARGIN = 5; // If you're in the last 5 pixels of the scroll area, we say you're at the bottom

const EmptyStateOverlay = styled(EmptyState)`
    position: absolute;
    top: ${HEADER_FOOTER_HEIGHT}px;
    bottom: 0;
    height: auto;

    line-height: 1.3;
`;

interface ViewEventListProps {
    className?: string;
    events: ReadonlyArray<CollectedEvent>;
    filteredEvents: ReadonlyArray<CollectedEvent>;
    selectedEvent: CollectedEvent | undefined;
    isPaused: boolean;

    contextMenuBuilder: ViewEventContextMenuBuilder;
    uiStore: UiStore;

    moveSelection: (distance: number) => void;
    onSelected: (event: CollectedEvent | undefined) => void;
}

const ListContainer = styled.div<{ role: 'table' }>`
    display: block;
    flex-grow: 1;
    position: relative;
    width: 100%;
    box-sizing: border-box;

    font-size: ${p => p.theme.textSize};

    &::after { /* Insert shadow over table contents */
        content: '';
        position: absolute;
        top: ${HEADER_FOOTER_HEIGHT}px;
        bottom: 0;
        left: 0;
        right: 0;
        box-shadow: rgba(0, 0, 0, 0.1) 0px 0px 30px inset;
        pointer-events: none;
    }

    & > div > div[tabindex="0"]:focus {
        outline: thin dotted ${p => p.theme.popColor};
    }
`;

const columnStyles = css`
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 3px 0;
`;

const Column = styled.div<{ role: 'cell' | 'columnheader' }>`
    ${columnStyles}
`;

const ColumnVisibilityToggle = inject('uiStore')(observer(({ columnName, uiStore, children }: {
    columnName: string,
    uiStore?: UiStore,
    children?: React.ReactNode
}) => {
    //Render by default
    let renderComponent = true;

    if (uiStore) {
        const { visibleViewColumns } = uiStore;
        renderComponent = visibleViewColumns.get(columnName) === true
    }

    return (
        <>
            {renderComponent && (children ?? children)}
        </>
    )
}));

const RowPin = styled(
    filterProps(Icon, 'pinned')
).attrs((p: { pinned: boolean }) => ({
    icon: ['fas', 'thumbtack'],
    title: p.pinned ? "This exchange is pinned, and won't be deleted by default" : ''
}))`
    font-size: 90%;
    background-color: ${p => p.theme.containerBackground};

    /* Without this, 0 width pins create a large & invisible but still clickable icon */
    overflow: hidden;

    transition: width 0.1s, padding 0.1s, margin 0.1s;

    ${(p: { pinned: boolean }) =>
        p.pinned
            ? `
            width: auto;
            padding: 8px 7px;
            && { margin-right: -3px; }
        `
            : `
            padding: 8px 0;
            width: 0 !important;
            margin: 0 !important;

            > path {
                display: none;
            }
        `
    }
`;

const RowMarker = styled(Column)`
    transition: color 0.2s;
    color: ${(p: { category: EventCategory }) => getSummaryColor(p.category)};

    background-color: currentColor;

    flex-basis: 5px;
    flex-shrink: 0;
    flex-grow: 0;
    height: 100%;
    padding: 0;

    border-left: 5px solid ${p => p.theme.containerBackground};
`;

const MarkerHeader = styled.div<{ role: 'columnheader' }>`
    flex-basis: 10px;
    flex-shrink: 0;
`;

const BaseTimestamp = ({ timestamp, role = 'cell', className, children }: {
    timestamp?: number,
    role?: 'columnheader' | 'cell',
    className?: string,
    children?: React.ReactNode
}) => {
    return (
        <ColumnVisibilityToggle columnName='Timestamp'>
            <div role={role} className={className}>
                {timestamp != null ? (new Date(timestamp).toLocaleTimeString()) : (children ?? '-')}
            </div>
        </ColumnVisibilityToggle>
    );
};

const Timestamp = styled(BaseTimestamp)`
    ${columnStyles};
    transition: flex-basis 0.1s;
    flex-shrink: 0;
    flex-grow: 0;
`;

const Method = styled(Column)`
    transition: flex-basis 0.1s;
    ${(p: { pinned?: boolean }) =>
        p.pinned
            ? 'flex-basis: 50px;'
            : 'flex-basis: 71px;'
    }

    flex-shrink: 0;
    flex-grow: 0;
`;

const Status = styled(Column)`
    flex-basis: 45px;
    flex-shrink: 0;
    flex-grow: 0;
`;

const Source = styled(Column)`
    flex-basis: 49px;
    flex-shrink: 0;
    flex-grow: 0;

    display: flex;
    align-items: center;
    justify-content: center;
`;

const Host = styled(Column)`
    flex-shrink: 1;
    flex-grow: 0;
    flex-basis: 500px;
`;

const PathAndQuery = styled(Column)`
    flex-shrink: 1;
    flex-grow: 0;
    flex-basis: 1000px;
`;

const BaseDuration = observer(({ exchange, role = 'cell', className, children }: {
    exchange?: HttpExchange, role?: 'columnheader' | 'cell',
    className?: string,
    children?: React.ReactNode
}) => {
    let duration: string | null | undefined;
    if (exchange != null) {
        duration = calculateAndFormatDuration({ timingEvents: exchange.timingEvents });
    }
    return (
        <ColumnVisibilityToggle columnName='Duration'>
            <div role={role} className={className}>
                {duration ?
                    duration :
                    (children ?? 'Duration')
                }
            </div>
        </ColumnVisibilityToggle>
    );
});

const Duration = styled(BaseDuration)`
    ${columnStyles};
    flex-basis: 71px;
    flex-shrink: 0;
    flex-grow: 0;
`;


// Match Method + Status, but shrink right margin slightly so that
// spinner + "WebRTC Media" fits OK.
const EventTypeColumn = styled(Column)`
    transition: flex-basis 0.1s;
    ${(p: { pinned?: boolean }) =>
        p.pinned
            ? 'flex-basis: 109px;'
            : 'flex-basis: 130px;'
    }

    margin-right: 6px !important;

    flex-shrink: 0;
    flex-grow: 0;
`;

// Match Host column:
const RTCEventLabel = styled(Column)`
    flex-shrink: 1;
    flex-grow: 0;
    flex-basis: 500px;

    > svg {
        padding-right: 0; /* Right, not left - it's rotated */
    }
`;

// Match PathAndQuery column:
const RTCEventDetails = styled(Column)`
    flex-shrink: 1;
    flex-grow: 0;
    flex-basis: 1000px;
`;

const RTCConnectionDetails = styled(RTCEventDetails)`
    text-align: center;
`;

// Host + Path + Query columns:
const BuiltInApiRequestDetails = styled(Column)`
    flex-shrink: 1;
    flex-grow: 0;
    flex-basis: 1000px;
`;

const EventListRow = styled.div<{ role: 'row' }>`
    display: flex;
    flex-direction: row;
    align-items: center;

    user-select: none;
    cursor: pointer;

    &.selected {
        background-color: ${p => p.theme.highlightBackground};
        font-weight: bold;

        color: ${p => p.theme.highlightColor};
        fill: ${p => p.theme.highlightColor};

        * {
            /* Override status etc colours to ensure contrast & give row max visibility */
            color: ${p => p.theme.highlightColor};
            fill: ${p => p.theme.highlightColor};
        }
    }

    &:focus {
        outline: thin dotted ${p => p.theme.popColor};
    }
`;

const TrafficEventListRow = styled(EventListRow)`
    background-color: ${props => props.theme.mainBackground};

    border-width: 2px 0;
    border-style: solid;
    border-color: transparent;
    background-clip: padding-box;
    box-sizing: border-box;

    &:hover ${RowMarker}, &.selected ${RowMarker} {
        border-color: currentColor;
    }

    > * {
        margin-right: 10px;
    }
`;

const TlsListRow = styled(EventListRow)`
    height: 28px !important; /* Important required to override react-window's style attr */
    margin: 2px 0 2px 20px;

    &:hover {
        opacity: 1;
    }

    &.selected {
        opacity: 1;
        color: ${p => p.theme.mainColor};
        background-color: ${p => p.theme.mainBackground};
    }
`;

const TlsRowDescription = styled(Column)`
    flex-grow: 1;
    font-style: italic;
    justify-content: center;
    text-align: center;
    opacity: 0.7;
`;
export const TableHeaderRow = styled.div<{ role: 'row' }>`
    height: 38px;
    overflow: hidden;
    width: 100%;

    display: flex;
    flex-direction: row;
    align-items: center;

    background-color: ${props => props.theme.mainBackground};
    color: ${props => props.theme.mainColor};
    font-weight: bold;

    border-bottom: 1px solid ${props => props.theme.containerBorder};
    box-shadow: 0 0 30px rgba(0,0,0,0.2);

    padding-right: 18px;
    box-sizing: border-box;

    > div[role=columnheader] {
        padding: 5px 0;
        margin-right: 10px;
        min-width: 0px;

        &:first-of-type {
            margin-left: 0;
        }
    }
`;

interface EventRowProps extends ListChildComponentProps {
    data: {
        selectedEvent: CollectedEvent | undefined;
        events: ReadonlyArray<CollectedEvent>;
        contextMenuBuilder: ViewEventContextMenuBuilder;
    }
}

const EventRow = observer((props: EventRowProps) => {
    const { index, style } = props;
    const { events, selectedEvent, contextMenuBuilder } = props.data;
    const event = events[index];

    const isSelected = (selectedEvent === event);

    if (event.isTlsFailure() || event.isTlsTunnel()) {
        return <TlsRow
            index={index}
            isSelected={isSelected}
            style={style}
            tlsEvent={event}
        />;
    } else if (event.isHttp()) {
        if (event.apiSpec?.isBuiltInApi && event.api?.matchedOperation()) {
            return <BuiltInApiRow
                index={index}
                isSelected={isSelected}
                style={style}
                exchange={event}
                contextMenuBuilder={contextMenuBuilder}
            />
        } else {
            return <ExchangeRow
                index={index}
                isSelected={isSelected}
                style={style}
                exchange={event}
                contextMenuBuilder={contextMenuBuilder}
            />;
        }
    } else if (event.isRTCConnection()) {
        return <RTCConnectionRow
            index={index}
            isSelected={isSelected}
            style={style}
            event={event}
        />;
    } else if (event.isRTCDataChannel() || event.isRTCMediaTrack()) {
        return <RTCStreamRow
            index={index}
            isSelected={isSelected}
            style={style}
            event={event}
        />;
    } else if (event.isRawTunnel()) {
        return <RawTunnelRow
            index={index}
            isSelected={isSelected}
            style={style}
            event={event}
        />;
    } else {
        throw new UnreachableCheck(event);
    }
});

const ExchangeRow = inject('uiStore')(observer(({
    index,
    isSelected,
    style,
    exchange,
    contextMenuBuilder
}: {
    index: number,
    isSelected: boolean,
    style: {},
    exchange: HttpExchange,
    contextMenuBuilder: ViewEventContextMenuBuilder
}) => {
    const {
        request,
        response,
        pinned,
        category
    } = exchange;

    return <TrafficEventListRow
        role="row"
        aria-label={
            `${_.startCase(exchange.category)} ${
                request.method
            } request ${
                response === 'aborted' || exchange.isWebSocket()
                    ? '' // Stated by the category already
                : exchange.downstream.isBreakpointed
                    ? 'waiting at a breakpoint'
                : !response
                    ? 'waiting for a response'
                // Actual response:
                    : `with a ${response.statusCode} response`
            } sent to ${
                // We include host+path but not protocol or search here, to keep this short
                request.parsedUrl.host + request.parsedUrl.pathname
            } by ${
                request.source.summary
            }`
        }
        aria-rowindex={index + 1}
        data-event-id={exchange.id}
        tabIndex={isSelected ? 0 : -1}
        onContextMenu={contextMenuBuilder.getContextMenuCallback(exchange)}
        className={isSelected ? 'selected' : ''}
        style={style}
    >
        <RowPin aria-label={pinned ? 'Pinned' : undefined} pinned={pinned} />
        <RowMarker role='cell' category={category} title={describeEventCategory(category)} />
        <Timestamp role='cell' timestamp={request.timingEvents.startTime} />
        <Method role='cell' pinned={pinned}>{request.method}</Method>
        <Status role='cell'>
            {
                response === 'aborted'
                    ? <StatusCode status={'aborted'} />
                    : exchange.downstream.isBreakpointed
                        ? <WarningIcon title='Breakpointed, waiting to be resumed' />
                        : exchange.isWebSocket() && response?.statusCode === 101
                            ? <StatusCode // Special UI for accepted WebSockets
                                status={exchange.closeState
                                    ? 'WS:closed'
                                    : 'WS:open'
                                }
                                message={`${exchange.closeState
                                    ? 'A closed'
                                    : 'An open'
                                    } WebSocket connection`}
                            />
                            : <StatusCode
                                status={response?.statusCode}
                                message={response?.statusMessage}
                            />
            }
        </Status>
        <Source role='cell'>
            <Icon
                title={request.source.summary}
                {...request.source.icon}
                fixedWidth={true}
            />
            {
                exchange.matchedRule &&
                exchange.matchedRule.stepTypes.some(t =>
                    t !== 'passthrough' && t !== 'ws-passthrough' && t !== 'rtc-dynamic-proxy'
                ) &&
                <PhosphorIcon
                    icon='Pencil'
                    alt={`Handled by 
                        ${exchange.matchedRule.stepTypes.length === 1 ?
                            nameStepClass(exchange.matchedRule.stepTypes[0])
                            : 'multi-step'
                        } rule`}
                    size='20px'
                    color={getSummaryColor('mutative')}
                />
            }
        </Source>
        <Host role='cell' title={request.parsedUrl.host}>
            {request.parsedUrl.host}
        </Host>
        <PathAndQuery role='cell' title={request.parsedUrl.pathname + request.parsedUrl.search}>
            {request.parsedUrl.pathname + request.parsedUrl.search}
        </PathAndQuery>
        <Duration role='cell' exchange={exchange} />
    </TrafficEventListRow>;
}));

const ConnectedSpinnerIcon = styled(Icon).attrs(() => ({
    icon: ['fas', 'spinner'],
    spin: true,
    title: 'Connected'
}))`
    margin: 0 5px 0 0;
`;

const RTCConnectionRow = observer(({
    index,
    isSelected,
    style,
    event
}: {
    index: number,
    isSelected: boolean,
    style: {},
    event: RTCConnection
}) => {
    const { category, pinned } = event;

    return <TrafficEventListRow
        role="row"
        aria-label={
            `${
                event.closeState ? 'Closed' : 'Open'
            } RTC connection from ${
                event.clientURL
            } to ${
                event.remoteURL ?? 'an unknown peer'
            } opened by ${
                event.source.summary
            }`
        }
        aria-rowindex={index + 1}
        data-event-id={event.id}
        tabIndex={isSelected ? 0 : -1}

        className={isSelected ? 'selected' : ''}
        style={style}
    >
        <RowPin pinned={pinned} />
        <RowMarker role='cell' category={category} title={describeEventCategory(category)} />
        <Timestamp role='cell' /> //TODO: Expose timingEvents
        <EventTypeColumn role='cell'>
            { !event.closeState && <ConnectedSpinnerIcon /> } WebRTC
        </EventTypeColumn>
        <Source role='cell' title={event.source.summary}>
            <Icon
                {...event.source.icon}
                fixedWidth={true}
            />
        </Source>
        <RTCConnectionDetails role='cell'>
            {
                event.clientURL
            } <ArrowIcon direction='right' /> {
                event.remoteURL || '?'
            }
        </RTCConnectionDetails>
    </TrafficEventListRow>;
});

const RTCStreamRow = observer(({
    index,
    isSelected,
    style,
    event
}: {
    index: number,
    isSelected: boolean,
    style: {},
    event: RTCStream
}) => {
    const { category, pinned } = event;

    return <TrafficEventListRow
        role="row"
        aria-label={
            `${
                event.closeState ? 'Closed' : 'Open'
            } RTC ${
                event.isRTCDataChannel() ? 'data' : 'media'
            } stream to ${
                event.rtcConnection.remoteURL
            } opened by ${
                event.rtcConnection.source.summary
            } ${
                event.isRTCDataChannel()
                ? `called ${
                        event.label
                    }${
                        event.protocol ? ` (${event.protocol})` : ''
                    } with ${event.messages.length} message${
                        event.messages.length !== 1 ? 's' : ''
                    }`
                : `for ${event.direction} ${event.type} with ${
                        getReadableSize(event.totalBytesSent)
                    } sent and ${
                        getReadableSize(event.totalBytesReceived)
                    } received`
            }`
        }
        aria-rowindex={index + 1}
        data-event-id={event.id}
        tabIndex={isSelected ? 0 : -1}

        className={isSelected ? 'selected' : ''}
        style={style}
    >
        <RowPin pinned={pinned} />
        <RowMarker role='cell' category={category} title={describeEventCategory(category)} />
        <Timestamp role='cell' /> //TODO: Expose timingEvents
        <EventTypeColumn role='cell'>
            { !event.closeState && <ConnectedSpinnerIcon /> } WebRTC {
                event.isRTCDataChannel()
                    ? 'Data'
                : // RTCMediaTrack:
                    'Media'
            }
        </EventTypeColumn>
        <Source role='cell' title={event.rtcConnection.source.summary}>
            <Icon
                {...event.rtcConnection.source.icon}
                fixedWidth={true}
            />
        </Source>
        <RTCEventLabel role='cell'>
            <ArrowIcon direction='right' /> { event.rtcConnection.remoteURL }
        </RTCEventLabel>
        <RTCEventDetails role='cell'>
            {
                event.isRTCDataChannel()
                    ? <>
                        { event.label } <em>
                            ({event.protocol ? `${event.protocol} - ` : ''}
                            { event.messages.length } message{
                                event.messages.length !== 1 ? 's' : ''
                            })
                        </em>
                    </>
                // Media track:
                    : <>
                        { event.direction } { event.type } <em>{
                            getReadableSize(event.totalBytesSent)
                        } sent, {
                            getReadableSize(event.totalBytesReceived)
                        } received</em>
                    </>
            }
        </RTCEventDetails>
    </TrafficEventListRow>;
});

const BuiltInApiRow = observer((p: {
    index: number,
    exchange: HttpExchange,
    isSelected: boolean,
    style: {},
    contextMenuBuilder: ViewEventContextMenuBuilder
}) => {
    const {
        request,
        pinned,
        category
    } = p.exchange;
    const api = p.exchange.api!; // Only shown for built-in APIs, so this must be set

    const apiOperationName =  _.startCase(
        api.operation.name
        .replace('eth_', '') // One-off hack for Ethereum, but result looks much nicer.
    );

    const apiRequestDescription = api.request.parameters
        .filter(param => param.value !== undefined)
        .map(param => `${param.name}=${JSON.stringify(param.value)}`)
        .join(', ');

    return <TrafficEventListRow
        role="row"
        aria-label={
            `${_.startCase(category)} ${
                api.service.shortName
            } ${
                apiOperationName
            }${
                apiRequestDescription
                ? ` with ${apiRequestDescription}`
                : ''
            } sent by ${
                request.source.summary
            }`
        }
        aria-rowindex={p.index + 1}
        data-event-id={p.exchange.id}
        tabIndex={p.isSelected ? 0 : -1}

        onContextMenu={p.contextMenuBuilder.getContextMenuCallback(p.exchange)}
        className={p.isSelected ? 'selected' : ''}
        style={p.style}
    >
        <RowPin pinned={pinned} />
        <RowMarker role='cell' category={category} title={describeEventCategory(category)} />
        <Timestamp role='cell' timestamp={request.timingEvents.startTime} />
        <EventTypeColumn role='cell'>
            {api.service.shortName}: {apiOperationName}
        </EventTypeColumn>
        <Source role='cell' title={request.source.summary}>
            <Icon
                {...request.source.icon}
                fixedWidth={true}
            />
        </Source>
        <BuiltInApiRequestDetails role='cell'>
            {apiRequestDescription}
        </BuiltInApiRequestDetails>
        <Duration role='cell' exchange={p.exchange} />
    </TrafficEventListRow>
});

const RawTunnelRow = observer((p: {
    index: number,
    event: RawTunnel,
    isSelected: boolean,
    style: {}
}) => {
    const { event } = p;

    const connectionTarget = event.upstreamHostname
        ? `${event.upstreamHostname}:${event.upstreamPort}`
        : 'unknown destination';

    return <TlsListRow
        role="row"
        aria-label={`Non-HTTP connection to ${connectionTarget}`}
        aria-rowindex={p.index + 1}
        data-event-id={event.id}
        tabIndex={p.isSelected ? 0 : -1}

        className={p.isSelected ? 'selected' : ''}
        style={p.style}
    >
        {
            event.isOpen() &&
                <ConnectedSpinnerIcon />
        } Non-HTTP connection to { connectionTarget }
    </TlsListRow>
});

const TlsRow = observer((p: {
    index: number,
    tlsEvent: FailedTlsConnection | TlsTunnel,
    isSelected: boolean,
    style: {}
}) => {
    const { tlsEvent } = p;

    const description = tlsEvent.isTlsTunnel()
        ? 'Tunnelled TLS '
        : ({
            'closed': 'Aborted ',
            'reset': 'Aborted ',
            'unknown': 'Aborted ',
            'cert-rejected': 'Certificate rejected for ',
            'no-shared-cipher': 'HTTPS setup failed for ',
        } as _.Dictionary<string>)[tlsEvent.failureCause];

    const connectionTarget = tlsEvent.upstreamHostname || 'unknown domain';

    return (
        <TlsListRow
            role="row"
            aria-label={`${description} connection to ${connectionTarget}`}
            aria-rowindex={p.index + 1}
            data-event-id={tlsEvent.id}
            tabIndex={p.isSelected ? 0 : -1}
            className={p.isSelected ? 'selected' : ''}
            style={p.style}

        >
            <Timestamp role='cell' timestamp={tlsEvent.timingEvents.startTime} />
            <TlsRowDescription role='cell'>
                {
                    tlsEvent.isTlsTunnel() &&
                    tlsEvent.isOpen() &&
                    <ConnectedSpinnerIcon />
                } {
                    description
                } connection to {connectionTarget}
            </TlsRowDescription>
        </TlsListRow>
    );
});

@observer
export class ViewEventList extends React.Component<ViewEventListProps> {

    @computed
    get selectedEventId() {
        return this.props.selectedEvent
            ? this.props.selectedEvent.id
            : undefined;
    }

    @computed get listItemData(): EventRowProps['data'] {
        return {
            selectedEvent: this.props.selectedEvent,
            events: this.props.filteredEvents,
            contextMenuBuilder: this.props.contextMenuBuilder
        };
    }

    private listBodyRef = React.createRef<HTMLDivElement>();
    private listRef = React.createRef<List>();

    private setListBodyRef = (element: HTMLDivElement | null) => {
        // Update the ref
        (this.listBodyRef as any).current = element;

        // If the element is being mounted and we haven't restored state yet, do it now
        if (element && !this.hasRestoredScrollState) {
            this.restoreScrollPosition();
            this.hasRestoredScrollState = true;
        }
    };

    private KeyBoundListWindow = observer(
        React.forwardRef<HTMLDivElement>(
            (props: any, ref) => <div
                {...props}
                style={Object.assign({}, props.style, { 'overflowY': 'scroll' })}
                ref={ref}

                onFocus={this.focusSelectedEvent}
                onKeyDown={this.onKeyDown}
                onMouseDown={this.onListMouseDown}
                tabIndex={this.isSelectedEventVisible() ? -1 : 0}
            />
        )
    );

    render() {
        const { events, filteredEvents, isPaused } = this.props;

        return <ListContainer role="table">
            <TableHeaderRow
                role="row"
                onContextMenu={this.props.contextMenuBuilder.getHeaderToggleContextMenu(this.props.uiStore.visibleViewColumns)}
            >
                <MarkerHeader role="columnheader" aria-label="Category" />
                <Timestamp role="columnheader">Timestamp</Timestamp>
                <Method role="columnheader">Method</Method>
                <Status role="columnheader">Status</Status>
                <Source role="columnheader">Source</Source>
                <Host role="columnheader">Host</Host>
                <PathAndQuery role="columnheader">Path and query</PathAndQuery>
                <Duration role="columnheader">Duration</Duration>
            </TableHeaderRow>

            {
                events.length === 0
                    ? (isPaused
                        ? <EmptyStateOverlay icon='Pause'>
                            Interception is paused, resume it to collect intercepted requests
                        </EmptyStateOverlay>
                        : <EmptyStateOverlay icon='Plug'>
                            Connect a client and intercept some requests, and they'll appear here
                        </EmptyStateOverlay>
                    )

                    : filteredEvents.length === 0
                        ? <EmptyStateOverlay icon='QuestionMark'>
                            No requests match this search filter{
                                isPaused ? ' and interception is paused' : ''
                            }
                        </EmptyStateOverlay>

                        : <AutoSizer>{({ height, width }) =>
                            <Observer>{() =>
                                <List
                                    innerRef={this.setListBodyRef}
                                    outerElementType={this.KeyBoundListWindow}
                                    ref={this.listRef}

                                    height={height - HEADER_FOOTER_HEIGHT}
                                    width={width}
                                    itemCount={filteredEvents.length}
                                    itemSize={32}
                                    itemData={this.listItemData}

                                    onScroll={this.updateScrolledState}
                                >
                                    {EventRow}
                                </List>
                            }</Observer>
                        }</AutoSizer>
            }
        </ListContainer>;
    }

    private isSelectedEventVisible = () => {
        if (!this.selectedEventId) return false;

        const listBody = this.listBodyRef.current;
        if (!listBody) return false;

        return !!listBody.querySelector(`[data-event-id='${this.selectedEventId}']`);
    }

    private focusEvent(event?: CollectedEvent) {
        const listBody = this.listBodyRef.current;
        if (!listBody) return;

        if (event) {
            const rowElement = listBody.querySelector(
                `[data-event-id='${event.id}']`
            ) as HTMLDivElement;
            rowElement?.focus();
        } else {
            const listWindow = listBody.parentElement!;
            listWindow.focus();
        }
    }

    private focusSelectedEvent = () => {
        this.focusEvent(this.props.selectedEvent);
    }

    focusList() {
        const { selectedEvent } = this.props;
        if (selectedEvent) {
            this.scrollToEvent(selectedEvent);
        } else {
            const listWindow = this.listBodyRef.current?.parentElement;
            listWindow?.focus();
        }
    }

    private isListAtBottom() {
        const listWindow = this.listBodyRef.current?.parentElement;
        if (!listWindow) return true; // This means no rows, so we are effectively at the bottom
        else return (listWindow.scrollTop + SCROLL_BOTTOM_MARGIN) >= (listWindow.scrollHeight - listWindow.offsetHeight);
    }

    private wasListAtBottom = true;

    private updateScrolledState = () => {
        requestAnimationFrame(() => { // Measure async, once the scroll has actually happened
            this.wasListAtBottom = this.isListAtBottom();

            // Only save scroll position after we've restored the initial state
            if (this.hasRestoredScrollState) {
                const listWindow = this.listBodyRef.current?.parentElement;

                const scrollPosition = this.wasListAtBottom
                    ? 'end'
                    : (listWindow?.scrollTop ?? 'end');
                if (listWindow) {
                    this.props.uiStore.setViewScrollPosition(scrollPosition);
                }
            }
        });
    }

    private hasRestoredScrollState = false;

    componentDidUpdate(prevProps: ViewEventListProps) {
        if (this.listBodyRef.current?.parentElement?.contains(document.activeElement)) {
            // If we previously had something here focused, and we've updated, update
            // the focus too, to make sure it's in the right place.
            this.focusSelectedEvent();
        }

        // If we previously were scrolled to the bottom of the list, but now we're not,
        // scroll there again ourselves now.
        if (this.wasListAtBottom && !this.isListAtBottom()) {
            this.listRef.current?.scrollToItem(this.props.events.length - 1);
        } else if (prevProps.selectedEvent !== this.props.selectedEvent && this.props.selectedEvent) {
            // If the selected event changed and we have a selected event, scroll to it
            // This handles restoring the selected event when returning to the tab
            this.scrollToEvent(this.props.selectedEvent);
        }
    }

    private restoreScrollPosition = () => {
        const savedPosition = this.props.uiStore.viewScrollPosition;
        const listWindow = this.listBodyRef.current?.parentElement;
        if (listWindow) {
            if (savedPosition === 'end') {
                listWindow.scrollTop = listWindow.scrollHeight;
            } else {
                // Only restore if we're not close to the current position (avoid unnecessary scrolling)
                if (Math.abs(listWindow.scrollTop - savedPosition) > 10) {
                    listWindow.scrollTop = savedPosition;
                }
            }
        }
    }

    public scrollToEvent(event: CollectedEvent) {
        const targetIndex = this.props.filteredEvents.indexOf(event);
        if (targetIndex === -1) return;

        this.listRef.current?.scrollToItem(targetIndex);

        requestAnimationFrame(() => this.focusEvent(event));
    }

    public scrollToCenterEvent(event: CollectedEvent) {
        const list = this.listRef.current;
        const listBody = this.listBodyRef.current;
        if (!list || !listBody) return;
        const listWindow = listBody.parentElement!;

        const targetIndex = this.props.filteredEvents.indexOf(event);
        if (targetIndex === -1) return;

        // TODO: scrollToItem("center") doesn't work well, need to resolve
        // https://github.com/bvaughn/react-window/issues/441 to fix this.
        const rowCount = this.props.filteredEvents.length;
        const rowHeight = 32;
        const windowHeight = listWindow.clientHeight;
        const halfHeight = windowHeight / 2;
        const rowOffset = targetIndex * rowHeight;
        const maxOffset = Math.max(0, rowCount * rowHeight - windowHeight);
        const targetOffset = rowOffset - halfHeight + rowHeight / 2;
        list.scrollTo(_.clamp(targetOffset, 0, maxOffset));

        // Focus the row, after the UI has updated, to make it extra obvious:
        requestAnimationFrame(() => this.focusEvent(event));
    }

    public scrollToEnd() {
        this.listRef.current?.scrollToItem(this.props.filteredEvents.length, 'start');
    }

    onListMouseDown = (mouseEvent: React.MouseEvent) => {
        if (mouseEvent.button !== 0) return; // Left clicks only

        let row: Element | null = mouseEvent.target as Element;
        let ariaRowIndex: string | null = null;

        // Climb up until we find the row, or the container
        while (ariaRowIndex === null && row && row !== this.listBodyRef.current) {
            // Be a little careful - React thinks event targets might not have getAttribute
            ariaRowIndex = row.getAttribute && row.getAttribute('aria-rowindex');
            row = row.parentElement;
        }

        if (!ariaRowIndex) return;

        const eventIndex = parseInt(ariaRowIndex, 10) - 1;
        const event = this.props.filteredEvents[eventIndex];
        if (event !== this.props.selectedEvent) {
            this.onEventSelected(eventIndex);
        } else {
            // Clicking the selected row deselects it
            this.onEventDeselected();
        }
    }

    @action.bound
    onEventSelected(index: number) {
        this.props.onSelected(this.props.filteredEvents[index]);
    }

    @action.bound
    onEventDeselected() {
        this.props.onSelected(undefined);
    }

    @action.bound
    onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        const { moveSelection } = this.props;

        switch (event.key) {
            case 'ArrowDown':
                moveSelection(1);
                break;
            case 'ArrowUp':
                moveSelection(-1);
                break;
            case 'PageUp':
                moveSelection(-10);
                break;
            case 'PageDown':
                moveSelection(10);
                break;
            case 'Home':
                moveSelection(-Infinity);
                break;
            case 'End':
                moveSelection(Infinity);
                break;
            default:
                return;
        }

        event.preventDefault();
    }
}