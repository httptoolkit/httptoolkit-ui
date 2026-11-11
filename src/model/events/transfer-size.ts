import * as _ from 'lodash';

import { CollectedEvent, RawHeaders } from '../../types';
import { StreamMessage } from './stream-message';

// Sized as HTTP/1 header lines ('name: value\r\n'). HTTP/2+ compresses headers, so this overestimates there.
const getRawHeadersSize = (headers: RawHeaders | undefined) =>
    _.sumBy(headers ?? [], ([name, value]) => name.length + value.length + 4);

const getMessagesSize = (messages: ReadonlyArray<StreamMessage>) =>
    _.sumBy(messages, (message) => message.content.byteLength);

function getEventTransferSize(event: CollectedEvent): number {
    if (event.isHttp()) {
        const { request } = event;
        const requestSize = getRawHeadersSize(request.rawHeaders) +
            request.body.encodedByteLength +
            getRawHeadersSize(request.rawTrailers);

        const responseSize = event.isSuccessfulExchange()
            ? getRawHeadersSize(event.response.rawHeaders) +
                event.response.body.encodedByteLength +
                getRawHeadersSize(event.response.rawTrailers)
            : 0;

        const messagesSize = event.isWebSocket()
            ? getMessagesSize(event.messages)
            : 0;

        return requestSize + responseSize + messagesSize;
    }

    if (event.isRawTunnel()) return getMessagesSize(event.packets);
    if (event.isRTCDataChannel()) return getMessagesSize(event.messages);
    if (event.isRTCMediaTrack()) return event.totalBytesSent + event.totalBytesReceived;

    // TLS failures have no content, TLS tunnels pass data through without capturing it,
    // and RTC connections' content is all within their streams.
    return 0;
}

// The approximate size of the data transferred for these events, as sent on the wire (so before
// any decompression). RTC connections include all their streams, and each is only counted once.
export function getTransferSize(events: ReadonlyArray<CollectedEvent>): number {
    const sizedEvents = new Set<CollectedEvent>();

    events.forEach((event) => {
        if (event.isRTCConnection()) event.streams.forEach((stream) => sizedEvents.add(stream));
        else sizedEvents.add(event);
    });

    return _.sumBy(Array.from(sizedEvents), getEventTransferSize);
}
