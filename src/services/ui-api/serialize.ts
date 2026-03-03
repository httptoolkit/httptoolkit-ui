import { toJS } from 'mobx';

import { HttpExchange, HtkResponse } from '../../types';

export interface ExchangeSummary {
    id: string;
    type: 'http';
    method: string;
    url: string;
    status: number | 'aborted' | undefined;
    source: string;
    timestamp: number;
}

export interface ExchangeOutline extends ExchangeSummary {
    httpVersion: string;
    tags: string[];
    timing: object;
    request: {
        method: string;
        url: string;
        httpVersion: string;
        headers: Record<string, string | string[]>;
        bodySize: number;
    };
    response: {
        statusCode: number;
        statusMessage: string;
        headers: Record<string, string | string[]>;
        bodySize: number;
    } | 'aborted' | undefined;
}

export interface SerializedBody {
    body: string | undefined;
    totalSize: number;
    isTruncated: boolean;
}

function getResponseStatus(exchange: HttpExchange): number | 'aborted' | undefined {
    if (exchange.response === 'aborted') return 'aborted';
    if (exchange.response) return (exchange.response as HtkResponse).statusCode;
    return undefined;
}

export function serializeExchangeSummary(exchange: HttpExchange): ExchangeSummary {
    return {
        id: exchange.id,
        type: 'http',
        method: exchange.request.method,
        url: exchange.request.url,
        status: getResponseStatus(exchange),
        source: exchange.request.source.summary,
        timestamp: exchange.timingEvents.startTime
    };
}

export function serializeExchangeOutline(exchange: HttpExchange): ExchangeOutline {
    let response: ExchangeOutline['response'];
    if (exchange.response === 'aborted') {
        response = 'aborted';
    } else if (exchange.response) {
        const htkResponse = exchange.response as HtkResponse;
        response = {
            statusCode: htkResponse.statusCode,
            statusMessage: htkResponse.statusMessage || '',
            headers: toJS(htkResponse.headers) as Record<string, string | string[]>,
            bodySize: htkResponse.body.encodedByteLength
        };
    }

    return {
        ...serializeExchangeSummary(exchange),
        httpVersion: exchange.request.httpVersion,
        tags: toJS(exchange.tags),
        timing: toJS(exchange.timingEvents),
        request: {
            method: exchange.request.method,
            url: exchange.request.url,
            httpVersion: exchange.request.httpVersion,
            headers: toJS(exchange.request.headers) as Record<string, string | string[]>,
            bodySize: exchange.request.body.encodedByteLength
        },
        response
    };
}

export async function serializeBody(
    exchange: HttpExchange,
    direction: 'request' | 'response',
    options: { offset?: number; maxLength?: number }
): Promise<SerializedBody> {
    if (direction === 'response') {
        if (exchange.response === 'aborted' || !exchange.response) {
            return { body: undefined, totalSize: 0, isTruncated: false };
        }

        const htkResponse = exchange.response as HtkResponse;
        return serializeBodyFromSource(htkResponse.body, options);
    }

    return serializeBodyFromSource(exchange.request.body, options);
}

async function serializeBodyFromSource(
    body: { waitForDecoding(): Promise<Buffer | undefined>; encodedByteLength: number },
    options: { offset?: number; maxLength?: number }
): Promise<SerializedBody> {
    const decoded = await body.waitForDecoding();
    if (!decoded) {
        return { body: undefined, totalSize: 0, isTruncated: false };
    }

    const text = decoded.toString('utf8');
    const totalSize = text.length;
    const offset = options.offset ?? 0;

    if (offset >= totalSize) {
        return { body: '', totalSize, isTruncated: false };
    }

    if (options.maxLength !== undefined) {
        const slice = text.slice(offset, offset + options.maxLength);
        return {
            body: slice,
            totalSize,
            isTruncated: offset + options.maxLength < totalSize
        };
    }

    const slice = offset > 0 ? text.slice(offset) : text;
    return { body: slice, totalSize, isTruncated: false };
}
