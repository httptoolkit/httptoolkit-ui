import * as React from 'react';
import { observer } from 'mobx-react';

import { ArrowIcon, Icon } from '../../../icons';
import { RTCConnection } from '../../../types';
import { describeEventCategory } from '../../../model/events/categorization';

import {
    TrafficEventListRow,
    RowPin,
    RowMarker,
    EventTypeColumn,
    Source,
    RTCConnectionDetails,
    ConnectedSpinnerIcon,
    CommonRowProps,
    InlineStatus,
    SourceIcon,
    RowDetail
} from './event-row-components';

export const RTCConnectionRow = observer((p: {
    rowProps: CommonRowProps,
    event: RTCConnection
}) => {
    const { event } = p;
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
        {...p.rowProps}
    >
        <RowPin pinned={pinned}/>
        <RowMarker role='gridcell' category={category} title={describeEventCategory(category)} />
        <EventTypeColumn role='gridcell'>
            { !event.closeState && <ConnectedSpinnerIcon /> } WebRTC
        </EventTypeColumn>
        <Source role='gridcell' title={event.source.summary}>
            <Icon
                {...event.source.icon}
                fixedWidth={true}
            />
        </Source>
        <RTCConnectionDetails role='gridcell'>
            {
                event.clientURL
            } <ArrowIcon direction='right' /> {
                event.remoteURL || '?'
            }
        </RTCConnectionDetails>
    </TrafficEventListRow>;
});

export function rtcConnectionPreviewContent(event: RTCConnection): React.ReactNode {
    return <>
        {!event.closeState && <InlineStatus status={undefined} />}
        <span>WebRTC</span>
        <SourceIcon {...event.source.icon} fixedWidth />
        <RowDetail>{event.clientURL} → {event.remoteURL || '?'}</RowDetail>
    </>;
}
