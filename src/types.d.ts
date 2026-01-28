import type { ComponentClass } from 'react';

import type {
    InitiatedRequest as MockttpInitiatedRequest,
    CompletedRequest as MockttpCompletedRequest,
    AbortedRequest as MockttpAbortedRequest,
    CompletedResponse as MockttpResponse,
    WebSocketMessage as MockttpWebSocketMessage,
    WebSocketClose as MockttpWebSocketClose,
    SubscribableEvent as MockttpEvent,
    Headers,
    RawHeaders,
    Trailers,
    RawTrailers,
    TimingEvents,
    TlsHandshakeFailure,
    TlsPassthroughEvent,
    TlsSocketMetadata,
    ClientError,
    RawPassthroughEvent,
    RawPassthroughDataEvent
} from 'mockttp';
import type { PortRange } from 'mockttp/dist/mockttp';

import type { requestSteps as MockttpRequestSteps } from 'mockttp';
type MockttpBreakpointedResponse = MockttpRequestSteps.PassThroughResponse;
type MockttpBreakpointRequestResult = MockttpRequestSteps.CallbackRequestResult;
type MockttpBreakpointResponseResult = MockttpRequestSteps.CallbackResponseResult;
type MockttpSerializedBuffer = MockttpRequestSteps.SerializedBuffer;

import * as MockRTC from 'mockrtc';

import type { ErrorLike } from './util/error';
import type { ParsedUrl } from './util/url';

import type { FailedTlsConnection } from './model/tls/failed-tls-connection';
import type { TlsTunnel } from './model/tls/tls-tunnel';
import type { RawTunnel, RawTunnelMessage } from './model/raw-tunnel';
import type { HttpExchange, HttpVersion } from './model/http/http-exchange';
import type { HttpExchangeView } from './model/http/http-exchange-views';

import type { WebSocketStream } from './model/websockets/websocket-stream';
import type { WebSocketView } from './model/websockets/websocket-views';
import type { RTCConnection } from './model/webrtc/rtc-connection';
import type { RTCDataChannel } from './model/webrtc/rtc-data-channel';
import type { RTCMediaTrack } from './model/webrtc/rtc-media-track';

import type { TrafficSource } from './model/http/sources';
import type { EditableBody } from './model/http/editable-body';
import type { ViewableContentType } from './model/events/content-types';
import type { ObservableCache } from './model/observable-cache';

// These are the HAR types as returned from parseHar(), not the raw types as defined in the HAR itself
export type HarBody = { encodedLength: number, decoded: Buffer };
export type HarRequest = Omit<MockttpCompletedRequest, 'body' | 'timingEvents' | 'matchedRuleId' | 'destination'> &
    { body: HarBody; timingEvents: TimingEvents, matchedRuleId: false };
export type HarResponse = Omit<MockttpResponse, 'body' | 'timingEvents'> &
    { body: HarBody; timingEvents: TimingEvents };

export type SentRequest = Omit<MockttpInitiatedRequest, 'matchedRuleId' | 'body' | 'destination'> &
    { matchedRuleId: false, body: { buffer: Buffer } };
export type SentRequestResponse = Omit<MockttpResponse, 'body'> &
    { body: { buffer: Buffer } };
export type SentRequestError = Pick<MockttpAbortedRequest, 'id' | 'timingEvents' | 'tags'> & {
    error: {
        code?: string;
        message?: string;
        stack?: string;
    };
}

export type ClientErrorRequest = ClientError['request'] & { matchedRuleId: false };

export type InputHTTPEvent = MockttpEvent;
export type InputClientError = ClientError;
export type InputTlsFailure = TlsHandshakeFailure &
    { hostname?: string }; // Backward compat for old servers;
export type InputTlsPassthrough = TlsPassthroughEvent &
    { hostname?: string, upstreamPort?: number }; // Backward compat for old servers
export type InputRawPassthrough = RawPassthroughEvent;
export type InputRawPassthroughData = RawPassthroughDataEvent;
export type InputInitiatedRequest = MockttpInitiatedRequest | HarRequest;
export type InputCompletedRequest = MockttpCompletedRequest | HarRequest | SentRequest;
export type InputFailedRequest = MockttpAbortedRequest | ClientErrorRequest | SentRequestError;
export type InputResponse = MockttpResponse | HarResponse | SentRequestResponse;
export type InputMessage = InputRequest | InputResponse;

export interface InputRequest {
    id: string;
    matchedRuleId?: string | false | undefined;

    httpVersion: string;
    method: string;
    url: string;
    headers: Headers;
    rawHeaders: RawHeaders;

    remoteIpAddress?: string;
    remotePort?: number;

    tags: string[];
    timingEvents: TimingEvents;
}

export type InputWebSocketMessage = MockttpWebSocketMessage;
export type InputWebSocketClose = MockttpWebSocketClose;

// Map from event name to data for each MockRTC event:
export type InputRTCEventData = MockRTC.MockRTCEventData;
export type InputRTCEvent = keyof InputRTCEventData;

export type InputRTCPeerConnected = InputRTCEventData['peer-connected'];
export type InputRTCExternalPeerAttached = InputRTCEventData['external-peer-attached'];
export type InputRTCPeerDisconnected = InputRTCEventData['peer-disconnected'];
export type InputRTCDataChannelOpened = InputRTCEventData['data-channel-opened'];
export type InputRTCDataChannelClosed = InputRTCEventData['data-channel-closed'];
export type InputRTCMessage =
    | InputRTCEventData['data-channel-message-received']
    | InputRTCEventData['data-channel-message-sent'];
export type InputRTCMediaTrackOpened = InputRTCEventData['media-track-opened'];
export type InputRTCMediaStats = InputRTCEventData['media-track-stats'];
export type InputRTCMediaTrackClosed = InputRTCEventData['media-track-closed'];

export type InputStreamMessage =
    | InputRTCMessage
    | InputWebSocketMessage
    | RawTunnelMessage;

interface InputRuleEventStructure<K, T> {
    requestId: string;
    ruleId: string;
    eventType: K;
    eventData: T;
}

export type InputRuleEventDataMap = {
    'passthrough-request-head': {
        method: string,
        protocol: string,
        hostname: string,
        port: string,
        path: string,
        rawHeaders: RawHeaders
    },
    'passthrough-request-body': {
        overridden: boolean,
        rawBody?: Uint8Array
    },
    'passthrough-response-head': {
        statusCode: number,
        statusMessage: string | undefined,
        httpVersion: string,
        rawHeaders: RawHeaders
    },
    'passthrough-response-body': {
        overridden: boolean,
        rawBody?: Uint8Array
    },
    'passthrough-abort': {
        downstreamAborted: boolean,
        tags: string[],
        error: {
            name?: string;
            code?: string;
            message?: string,
            stack?: string
        }
    },
    'passthrough-websocket-connect': InputRuleEventDataMap['passthrough-request-head'] & {
        subprotocols: string[]
    }
};

export type InputRuleEvent = ({
    [K in keyof InputRuleEventDataMap]: InputRuleEventStructure<
        K,
        InputRuleEventDataMap[K]
    >
})[keyof InputRuleEventDataMap];

// Define the restricted form of request BP result we'll use internally
export type BreakpointRequestResult = {
    method: string,
    url: string,
    rawHeaders: RawHeaders,
    body: EditableBody
};

// We still need this for the places where we actually interact with Mockttp
export {
    MockttpBreakpointRequestResult,
    MockttpBreakpointResponseResult,
    MockttpSerializedBuffer
};

// Define the restricted form of response BP result we'll use internally
export type BreakpointResponseResult = {
    statusCode: number,
    statusMessage?: string,
    rawHeaders: RawHeaders,
    body: EditableBody
};

export {
    MockttpCompletedRequest as MockttpBreakpointedRequest,
    MockttpBreakpointedResponse,
};

export type HtkRequest = Omit<InputRequest, 'body' | 'path'> & {
    parsedUrl: ParsedUrl,
    source: TrafficSource,
    contentType: ViewableContentType,
    cache: ObservableCache,
    body: MessageBody,
    trailers?: Trailers,
    rawTrailers?: RawTrailers
};

export type HtkResponse = Omit<InputResponse, 'body'> & {
    contentType: ViewableContentType,
    cache: ObservableCache,
    body: MessageBody
};

export interface MessageBody {
    encodedByteLength: number;
    decodedData: Buffer | undefined; // Set if decoded, undefined if pending or error

    isPending(): this is PendingMessageBody;
    isDecoded(): this is DecodedMessageBody;
    isFailed(): this is FailedDecodeMessageBody;

    waitForDecoding(): Promise<Buffer | undefined>;
    cleanup(): void;
}

export interface PendingMessageBody extends MessageBody {
    decodedData: undefined;
}

export interface DecodedMessageBody extends MessageBody {
    decodedData: Buffer;
}

export interface FailedDecodeMessageBody extends MessageBody {
    decodedData: undefined;
    encodedData: Buffer | undefined;
    decodingError: ErrorLike;
}

export type {
    FailedTlsConnection,
    TlsTunnel,
    RawTunnel,
    HttpExchange,
    HttpExchangeView,
    WebSocketStream,
    WebSocketView,
    RTCConnection,
    RTCDataChannel,
    RTCMediaTrack
};
export type CollectedEvent =
    | FailedTlsConnection
    | TlsTunnel
    | RawTunnel
    | HttpExchange
    | WebSocketStream
    | RTCConnection
    | RTCDataChannel
    | RTCMediaTrack;

export type ViewableEvent =
    | CollectedEvent
    | HttpExchangeView;

export type ExchangeMessage = HtkRequest | HtkResponse;
export type RTCStream = RTCDataChannel | RTCMediaTrack;

export type {
    HttpVersion,
    Headers,
    RawHeaders,
    Trailers,
    RawTrailers,
    PortRange,
    TimingEvents,
    TlsSocketMetadata
};

// Should only be created in the process of sanitizing, so every object with an
// __html prop must be HTML-safe.
export interface Html {
    __html: string
}

// Convenient funky TypeScript games

export type DomWithProps<T, Props> = ComponentClass<React.DetailedHTMLProps<React.HTMLAttributes<T> & Props, T>>;

export type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;

export type WithInjected<
    C extends React.ComponentType<any>,
    K extends string
> = C extends React.ComponentType<infer T> ?
    React.ComponentType<Omit<T, K>> : never;

// This lets us filter a type for only readonly/writable keys.
// It's sourced from https://stackoverflow.com/a/49579497/68051:

type IfEquals<X, Y, A=X, B=never> =
    (<T>() => T extends X ? 1 : 2) extends
    (<T>() => T extends Y ? 1 : 2) ? A : B;

export type ReadonlyKeys<T> = {
    [P in keyof T]-?: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, never, P>
}[keyof T];