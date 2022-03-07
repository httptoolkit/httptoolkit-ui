import * as _ from 'lodash';
import * as React from 'react';
import { get } from 'typesafe-get';
import { observer, Observer } from 'mobx-react';
import { action, computed } from 'mobx';

import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';

import { styled } from '../../styles'
import { Icon, WarningIcon } from '../../icons';
import { CollectedEvent, HttpExchange, FailedTlsRequest } from '../../types';

import {
    getExchangeSummaryColour,
    ExchangeCategory,
    describeExchangeCategory
} from '../../model/http/exchange-colors';

import { filterProps } from '../component-utils';
import { EmptyState } from '../common/empty-state';
import { StatusCode } from '../common/status-code';

import { HEADER_FOOTER_HEIGHT } from './view-event-list-footer';

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
    events: CollectedEvent[];
    filteredEvents: CollectedEvent[];
    selectedEvent: CollectedEvent | undefined;
    isPaused: boolean;

    moveSelection: (distance: number) => void;
    onSelected: (event: CollectedEvent | undefined) => void;
}

const ListContainer = styled.div`
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
`;

const Column = styled.div`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 3px 0;
`;

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
        `
    }
`;

const RowMarker = styled(Column)`
    transition: color 0.2s;
    color: ${(p: { category: ExchangeCategory }) => getExchangeSummaryColour(p.category)};

    background-color: currentColor;

    flex-basis: 5px;
    flex-shrink: 0;
    flex-grow: 0;
    height: 100%;
    padding: 0;

    border-left: 5px solid ${p => p.theme.containerBackground};
`;

const MarkerHeader = styled.div`
    flex-basis: 10px;
    flex-shrink: 0;
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
    text-align: center;
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

const EventListRow = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;

    user-select: none;
    cursor: pointer;

    &.selected {
        background-color: ${p => p.theme.highlightBackground};
        font-weight: bold;
    }

    &:focus {
        outline: thin dotted ${p => p.theme.popColor};
    }
`;

const ExchangeListRow = styled(EventListRow)`
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

const FailedRequestListRow = styled(EventListRow)`
    height: 28px !important; /* Important required to override react-window's style attr */
    margin: 2px 0;

    font-style: italic;
    justify-content: center;
    text-align: center;

    opacity: 0.7;

    &:hover {
        opacity: 1;
    }

    &.selected {
        opacity: 1;
        color: ${p => p.theme.mainColor};
        background-color: ${p => p.theme.mainBackground};
    }
`;

export const TableHeader = styled.header`
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

    > div {
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
        events: CollectedEvent[];
    }
}

const EventRow = observer((props: EventRowProps) => {
    const { index, style } = props;
    const { events, selectedEvent } = props.data;
    const event = events[index];

    const isSelected = (selectedEvent === event);

    if ('failureCause' in event) {
        return <FailedRequestRow
            index={index}
            isSelected={isSelected}
            style={style}
            failure={event}
        />;
    } else {
        return <ExchangeRow
            index={index}
            isSelected={isSelected}
            style={style}
            exchange={event}
        />;
    };
});

const ExchangeRow = observer(({
    index,
    isSelected,
    style,
    exchange: { id, category, pinned, isBreakpointed, request, response }
}: {
    index: number,
    isSelected: boolean,
    style: {},
    exchange: HttpExchange
}) =>
    <ExchangeListRow
        role="row"
        aria-label='row'
        aria-rowindex={index + 1}
        data-event-id={id}
        tabIndex={isSelected ? 0 : -1}

        className={isSelected ? 'selected' : ''}
        style={style}
    >
        <RowPin pinned={pinned}/>
        <RowMarker category={category} title={describeExchangeCategory(category)} />
        <Method pinned={pinned}>{ request.method }</Method>
        <Status>
            {
                response === 'aborted'
                    ? <StatusCode status={'aborted'} />
                : isBreakpointed
                    ? <WarningIcon title='Breakpointed, waiting to be resumed' />
                : <StatusCode
                    status={get(response, 'statusCode')}
                    message={get(response, 'statusMessage')}
                />
            }
        </Status>
        <Source title={request.source.summary}>
            <Icon
                {...request.source.icon}
                fixedWidth={true}
            />
        </Source>
        <Host title={ request.parsedUrl.host }>
            { request.parsedUrl.host }
        </Host>
        <PathAndQuery title={ request.parsedUrl.pathname + request.parsedUrl.search }>
            { request.parsedUrl.pathname + request.parsedUrl.search }
        </PathAndQuery>
    </ExchangeListRow>
);

const FailedRequestRow = observer((p: {
    index: number,
    failure: FailedTlsRequest,
    isSelected: boolean,
    style: {}
}) =>
    <FailedRequestListRow
        role="row"
        aria-label='row'
        aria-rowindex={p.index + 1}
        data-event-id={p.failure.id}
        tabIndex={p.isSelected ? 0 : -1}

        className={p.isSelected ? 'selected' : ''}
        style={p.style}
    >
        {
            ({
                'closed': 'Aborted ',
                'reset': 'Aborted ',
                'unknown': 'Aborted ',
                'cert-rejected': 'Certificate rejected for ',
                'no-shared-cipher': 'HTTPS setup failed for ',
            } as _.Dictionary<string>)[p.failure.failureCause]
        }
        connection to { p.failure.hostname || 'unknown domain' }
    </FailedRequestListRow>
);

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
            events: this.props.filteredEvents
        };
    }

    private listBodyRef = React.createRef<HTMLDivElement>();
    private listRef = React.createRef<List>();

    private KeyBoundListWindow = observer(
        React.forwardRef<HTMLDivElement>(
            (props: any, ref) => <section
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

        return <ListContainer>
            <TableHeader>
                <MarkerHeader />
                <Method>Method</Method>
                <Status>Status</Status>
                <Source>Source</Source>
                <Host>Host</Host>
                <PathAndQuery>Path and query</PathAndQuery>
            </TableHeader>

            {
                events.length === 0
                ? (isPaused
                    ? <EmptyStateOverlay icon={['fas', 'pause']}>
                        Interception is paused, resume it to collect intercepted requests
                    </EmptyStateOverlay>
                    : <EmptyStateOverlay icon={['fas', 'plug']}>
                        Connect a client and intercept some requests, and they'll appear here
                    </EmptyStateOverlay>
                )

                : filteredEvents.length === 0
                ? <EmptyStateOverlay icon={['fas', 'question']}>
                        No requests match this search filter{
                            isPaused ? ' and interception is paused' : ''
                        }
                </EmptyStateOverlay>

                : <AutoSizer>{({ height, width }) =>
                    <Observer>{() =>
                        <List
                            innerRef={this.listBodyRef}
                            outerElementType={this.KeyBoundListWindow}
                            ref={this.listRef}

                            height={height - HEADER_FOOTER_HEIGHT}
                            width={width}
                            itemCount={filteredEvents.length}
                            itemSize={32}
                            itemData={this.listItemData}

                            onScroll={this.updateScrolledState}
                        >
                            { EventRow }
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

    private isListAtBottom() {
        const listWindow = this.listBodyRef.current?.parentElement;
        if (!listWindow) return true; // This means no rows, so we are effectively at the bottom
        else return (listWindow.scrollTop + SCROLL_BOTTOM_MARGIN) >= (listWindow.scrollHeight - listWindow.offsetHeight);
    }

    private wasListAtBottom = true;
    private updateScrolledState = () => {
        requestAnimationFrame(() => { // Measure async, once the scroll has actually happened
            this.wasListAtBottom = this.isListAtBottom();
        });
    }

    componentDidMount() {
        this.updateScrolledState();
    }

    componentDidUpdate() {
        if (this.listBodyRef.current?.parentElement?.contains(document.activeElement)) {
            // If we previously had something here focused, and we've updated, update
            // the focus too, to make sure it's in the right place.
            this.focusSelectedEvent();
        }

        // If we previously were scrolled to the bottom of the list, but now we're not,
        // scroll there again ourselves now.
        if (this.wasListAtBottom && !this.isListAtBottom()) {
            this.listRef.current?.scrollToItem(this.props.events.length - 1);
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