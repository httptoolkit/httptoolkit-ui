import { RawHeaders } from "../../types";

export type ResponseStreamEvent =
    | RequestStartEvent
    | ResponseHeadEvent
    | ResponseBodyPartEvent
    | ResponseEndEvent
    | ErrorEvent;

interface RequestStartEvent {
    type: 'request-start';
    startTime: number;
    timestamp: number;
}

export interface ResponseHeadEvent {
    type: 'response-head';
    statusCode: number;
    statusMessage?: string;
    headers: RawHeaders;
    timestamp: number;
}

interface ResponseBodyPartEvent {
    type: 'response-body-part';
    rawBody: Buffer;
    timestamp: number;
}

interface ResponseEndEvent {
    type: 'response-end';
    timestamp: number;
}

interface ErrorEvent {
    type: 'error';
    timestamp: number;
    error: {
        code?: string,
        message?: string,
        stack?: string
    }
}
