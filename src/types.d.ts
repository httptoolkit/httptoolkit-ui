import type { ComponentClass } from 'react';

import type {
    InitiatedRequest as MockttpInitiatedRequest,
    CompletedRequest as MockttpCompletedRequest,
    CompletedResponse as MockttpResponse
} from 'mockttp';
import type {
    Headers,
    TimingEvents,
    TlsRequest,
    ClientError
} from 'mockttp/dist/types';
import type { PortRange } from 'mockttp/dist/mockttp';
import type {
    PassThroughResponse as MockttpBreakpointedResponse,
    CallbackRequestResult as MockttpBreakpointRequestResult,
    CallbackResponseResult as MockttpBreakpointResponseResult,
    SerializedBuffer as MockttpSerializedBuffer
} from 'mockttp/dist/rules/requests/request-handlers';

import type { ObservablePromise } from './util/observable';
import type { HttpExchange } from './model/http/exchange';
import type { TrafficSource } from './model/http/sources';
import type { ViewableContentType } from './model/http/content-types';

export type HarBody = { encodedLength: number, decoded: Buffer };
export type HarRequest = Omit<MockttpCompletedRequest, 'body' | 'timingEvents' | 'matchedRuleId'> &
    { body: HarBody; timingEvents: TimingEvents, matchedRuleId: "?" };
export type HarResponse = Omit<MockttpResponse, 'body' | 'timingEvents'> &
    { body: HarBody; timingEvents: TimingEvents };

export type InputClientError = ClientError;
export type InputTlsRequest = TlsRequest;
export type InputInitiatedRequest = MockttpInitiatedRequest;
export type InputCompletedRequest = MockttpCompletedRequest | HarRequest;
export type InputRequest = InputInitiatedRequest | InputCompletedRequest;
export type InputResponse = MockttpResponse | HarResponse;
export type InputMessage = InputRequest | InputResponse;

export interface BreakpointBody {
    decoded: Buffer;
    encoded: ObservablePromise<Buffer>;
    contentLength: number;
}

// Define the restricted form of request BP result we'll use internally
export type BreakpointRequestResult = {
    method: string,
    url: string,
    headers: Headers,
    body: BreakpointBody
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
    headers: Headers,
    body: BreakpointBody
};

export {
    MockttpCompletedRequest as MockttpBreakpointedRequest,
    MockttpBreakpointedResponse,
};

export type FailedTlsRequest = InputTlsRequest & {
    id: string;
    searchIndex: string;
    pinned: boolean;
}

export type HtkRequest = Omit<InputRequest, 'body' | 'path'> & {
    parsedUrl: URL & { parseable: boolean },
    source: TrafficSource,
    contentType: ViewableContentType,
    cache: Map<symbol, unknown>,
    body: MessageBody
};

export type HtkResponse = Omit<InputResponse, 'body'> & {
    contentType: ViewableContentType,
    cache: Map<symbol, unknown>,
    body: MessageBody
};

export type MessageBody = {
    encoded: { byteLength: number } | Buffer,
    decoded: Buffer | undefined,
    decodedPromise: ObservablePromise<Buffer | undefined>,
    cleanup(): void
};

export type { HttpExchange };
export type CollectedEvent =
    | HttpExchange
    | FailedTlsRequest;
export type ExchangeMessage = HtkRequest | HtkResponse;

export {
    Headers,
    PortRange,
    TimingEvents
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