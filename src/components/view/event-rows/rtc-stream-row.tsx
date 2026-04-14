import * as React from 'react';
import { observer } from 'mobx-react';

import { ArrowIcon, Icon } from '../../../icons';
import { RTCStream } from '../../../types';
import { describeEventCategory } from '../../../model/events/categorization';
import { getReadableSize } from '../../../util/buffer';

import {
    TrafficEventListRow,
    RowPin,
    RowMarker,
    EventTypeColumn,
    Source,
    RTCEventLabel,
    RTCEventDetails,
    ConnectedSpinnerIcon,
    CommonRowProps,
    InlineStatus,
    SourceIcon,
    RowDetail
} from './event-row-components';

export const RTCStreamRow = observer((p: {
    rowProps: CommonRowProps,
    event: RTCStream
}) => {
    const { event } = p;
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
        {...p.rowProps}
    >
        <RowPin pinned={pinned}/>
        <RowMarker role='gridcell' category={category} title={describeEventCategory(category)} />
        <EventTypeColumn role='gridcell'>
            { !event.closeState && <ConnectedSpinnerIcon /> } WebRTC {
                event.isRTCDataChannel()
                    ? 'Data'
                : // RTCMediaTrack:
                    'Media'
            }
        </EventTypeColumn>
        <Source role='gridcell' title={event.rtcConnection.source.summary}>
            <Icon
                {...event.rtcConnection.source.icon}
                fixedWidth={true}
            />
        </Source>
        <RTCEventLabel role='gridcell'>
            <ArrowIcon direction='right' /> { event.rtcConnection.remoteURL }
        </RTCEventLabel>
        <RTCEventDetails role='gridcell'>
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

export function rtcStreamPreviewContent(event: RTCStream): React.ReactNode {
    if (event.isRTCDataChannel()) {
        return <>
            {!event.closeState && <InlineStatus status={undefined} />}
            <span>WebRTC Data</span>
            <SourceIcon {...event.rtcConnection.source.icon} fixedWidth />
            <RowDetail>{event.label}</RowDetail>
        </>;
    } else {
        return <>
            {!event.closeState && <InlineStatus status={undefined} />}
            <span>WebRTC Media</span>
            <SourceIcon {...event.rtcConnection.source.icon} fixedWidth />
            <RowDetail>{event.direction} {event.type}</RowDetail>
        </>;
    }
}
