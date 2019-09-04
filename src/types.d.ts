import { ComponentClass } from 'react';
import { ObservableMap } from 'mobx';

import {
    InitiatedRequest as MockttpInitiatedRequest,
    CompletedRequest as MockttpCompletedRequest,
    CompletedResponse as MockttpResponse
} from 'mockttp';
import { Headers, RequestHeaders, TimingEvents, TlsRequest } from 'mockttp/dist/types';
import { PortRange } from 'mockttp/dist/mockttp';
import {
    PassThroughResponse as MockttpBreakpointedResponse,
    CallbackRequestResult as MockttpBreakpointRequestResult,
    CallbackResponseResult as MockttpBreakpointResponseResult
} from 'mockttp/dist/rules/handlers';

import { TrafficSource } from './model/sources';
import { ViewableContentType } from './model/content-types';
import { ObservablePromise } from './util';

export type HarBody = { encodedLength: number, decoded: Buffer };
export type HarRequest = Omit<MockttpCompletedRequest, 'body' | 'timingEvents'> &
    { body: HarBody; timingEvents: TimingEvents };
export type HarResponse = Omit<MockttpResponse, 'body' | 'timingEvents'> &
    { body: HarBody; timingEvents: TimingEvents };

export type InputTlsRequest = TlsRequest;
export type InputInitiatedRequest = MockttpInitiatedRequest;
export type InputCompletedRequest = MockttpCompletedRequest | HarRequest;
export type InputRequest = InputInitiatedRequest | InputCompletedRequest;
export type InputResponse = MockttpResponse | HarResponse;
export type InputMessage = InputRequest | InputResponse;

// Define the restricted form of request BP result we'll use internally
export type BreakpointRequestResult = Pick<
    MockttpBreakpointRequestResult, 'response'
> & Pick<
    Required<MockttpBreakpointRequestResult>,
    | 'method'
    | 'url'
    | 'headers'
> & {
    body: Buffer | undefined
};

// Define the restricted form of response BP result we'll use internally
export type BreakpointResponseResult = Pick<
    MockttpBreakpointResponseResult, 'statusMessage'
> & Pick<
    Required<MockttpBreakpointResponseResult>, 'statusCode' | 'headers'
> & {
    body: Buffer | undefined
};

export {
    MockttpCompletedRequest as MockttpBreakpointedRequest,
    MockttpBreakpointedResponse,
};

export type FailedTlsRequest = InputTlsRequest & {
    id: string;
    searchIndex: string[];
}

export type HtkRequest = Omit<InputRequest, 'body'> & {
    parsedUrl: URL,
    source: TrafficSource,
    contentType: ViewableContentType,
    cache: ObservableMap<symbol, unknown>,
    body: MessageBody
};

export type HtkResponse = Omit<InputResponse, 'body'> & {
    contentType: ViewableContentType,
    cache: ObservableMap<symbol, unknown>,
    body: MessageBody
};

export type MessageBody = {
    encoded: { byteLength: number } | Buffer,
    decoded: Buffer | undefined,
    decodedPromise: ObservablePromise<Buffer | undefined>
};

export type ExchangeMessage = HtkRequest | HtkResponse;

export {
    Headers,
    RequestHeaders,
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

export type WritableKeys<T> = {
    [P in keyof T]-?: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, P>
}[keyof T];

export type ReadonlyKeys<T> = {
    [P in keyof T]-?: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, never, P>
}[keyof T];