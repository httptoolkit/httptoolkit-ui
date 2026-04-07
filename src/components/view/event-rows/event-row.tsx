import * as React from 'react';
import { observer } from 'mobx-react';
import { ListChildComponentProps } from 'react-window';

import { CollectedEvent } from '../../../types';
import { getSummaryColor } from '../../../model/events/categorization';
import { UnreachableCheck } from '../../../util/error';

import { ViewEventContextMenuBuilder } from '../view-context-menu-builder';

import { ExchangeRow, exchangePreviewContent } from './exchange-row';
import { BuiltInApiRow, builtInApiPreviewContent } from './built-in-api-row';
import { RTCConnectionRow, rtcConnectionPreviewContent } from './rtc-connection-row';
import { RTCStreamRow, rtcStreamPreviewContent } from './rtc-stream-row';
import { RawTunnelRow, rawTunnelPreviewContent } from './raw-tunnel-row';
import { TlsRow, tlsPreviewContent } from './tls-row';

export interface EventRowProps extends ListChildComponentProps {
    data: {
        selectedEventIds: ReadonlySet<string>;
        activeEventId: string | undefined;
        events: ReadonlyArray<CollectedEvent>;
        contextMenuBuilder: ViewEventContextMenuBuilder;
    }
}

export const EventRow = observer((props: EventRowProps) => {
    const { index, style } = props;
    const { events, selectedEventIds, activeEventId, contextMenuBuilder } = props.data;
    const event = events[index];

    const isSelected = selectedEventIds.has(event.id);
    const isActive = event.id === activeEventId;

    const rowProps = {
        'aria-rowindex': index + 1,
        'aria-selected': isSelected,
        id: `event-row-${event.id}`,
        'data-event-id': event.id,
        className: (isSelected ? 'selected' : '') + (isActive ? ' active' : ''),
        style
    };

    if (event.isTlsFailure() || event.isTlsTunnel()) {
        return <TlsRow rowProps={rowProps} tlsEvent={event} />;
    } else if (event.isHttp()) {
        if (event.apiSpec?.isBuiltInApi && event.api?.matchedOperation()) {
            return <BuiltInApiRow
                rowProps={rowProps}
                exchange={event}
                contextMenuBuilder={contextMenuBuilder}
            />
        } else {
            return <ExchangeRow
                rowProps={rowProps}
                exchange={event}
                contextMenuBuilder={contextMenuBuilder}
            />;
        }
    } else if (event.isRTCConnection()) {
        return <RTCConnectionRow rowProps={rowProps} event={event} />;
    } else if (event.isRTCDataChannel() || event.isRTCMediaTrack()) {
        return <RTCStreamRow rowProps={rowProps} event={event} />;
    } else if (event.isRawTunnel()) {
        return <RawTunnelRow rowProps={rowProps} event={event} />;
    } else {
        throw new UnreachableCheck(event);
    }
});

/**
 * Returns preview content for an event, matching the list row's column order.
 * Used by the multi-selection summary pane.
 */
export function getEventPreviewContent(event: CollectedEvent): React.ReactNode {
    if (event.isTlsFailure() || event.isTlsTunnel()) {
        return tlsPreviewContent(event);
    } else if (event.isHttp()) {
        if (event.apiSpec?.isBuiltInApi && event.api?.matchedOperation()) {
            return builtInApiPreviewContent(event);
        } else {
            return exchangePreviewContent(event);
        }
    } else if (event.isRTCConnection()) {
        return rtcConnectionPreviewContent(event);
    } else if (event.isRTCDataChannel() || event.isRTCMediaTrack()) {
        return rtcStreamPreviewContent(event);
    } else if (event.isRawTunnel()) {
        return rawTunnelPreviewContent(event);
    }
    return '';
}

/**
 * Returns whether the event is a TLS/tunnel type that should be rendered
 * with a dimmed/transparent style in the preview.
 */
export function isOpaqueConnection(event: CollectedEvent): boolean {
    return event.isTlsFailure() || event.isTlsTunnel() || event.isRawTunnel();
}

/**
 * Returns the marker color for an event, or 'transparent' for opaque connections.
 */
export function getEventMarkerColor(event: CollectedEvent): string {
    return isOpaqueConnection(event) ? 'transparent' : getSummaryColor(event.category);
}
