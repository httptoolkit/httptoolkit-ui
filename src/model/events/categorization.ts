import * as _ from 'lodash';

import { ExchangeMessage } from '../../types';
import { Theme } from '../../styles';
import { getHeaderValue } from '../http/headers';

import { getBaseContentType } from './content-types';

import { HTKEventBase } from './event-base';
import { HttpExchangeView, SuccessfulExchange } from '../http/http-exchange-views';

export const getMessageBaseAcceptTypes = (message: ExchangeMessage) =>
    (getHeaderValue(message.headers, 'accept')?.split(',') || [])
        .map((acceptType) => getBaseContentType(acceptType));

export const getMessageBaseContentType = (message: ExchangeMessage) =>
    getBaseContentType(getHeaderValue(message.headers, 'content-type'));

const isMutatativeExchange = (exchange: HttpExchangeView) => _.includes([
    'POST',
    'PATCH',
    'PUT',
    'DELETE'
], exchange.request.method);

const isImageExchange = (exchange: SuccessfulExchange) => {
    const requestAcceptTypes = getMessageBaseAcceptTypes(exchange.request);
    if (
        requestAcceptTypes.length > 0 &&
        requestAcceptTypes.every(type => type.startsWith('image/'))
    ) {
        return true;
    }

    else if (exchange.request.headers['sec-fetch-dest'] === 'image') return true;

    else return getMessageBaseContentType(exchange.response).startsWith('image/');
}

const DATA_CONTENT_TYPES = [
    'application/json',
    'application/xml',
    'application/rss',
    'text/plain', // Not formally 'data', but usually used as such in practice
    'text/xml',
    'text/json',
    'multipart/form-data',
    'application/x-www-form-urlencoded',
    'application/x-protobuf'
];

const isDataExchange = (exchange: SuccessfulExchange) => {
    const requestAcceptTypes = getMessageBaseAcceptTypes(exchange.request)
    if (
        requestAcceptTypes.length > 0 &&
        requestAcceptTypes.every(type => DATA_CONTENT_TYPES.includes(type))
    ) {
        return true;
    }

    return _.includes(DATA_CONTENT_TYPES, getMessageBaseContentType(exchange.response));
}

const isJSExchange = (exchange: SuccessfulExchange) =>
    exchange.request.headers['sec-fetch-dest'] === 'script' ||
    _.includes([
        'text/javascript',
        'application/javascript',
        'application/x-javascript',
        'application/ecmascript'
    ], getMessageBaseContentType(exchange.response));

const isCSSExchange = (exchange: SuccessfulExchange) =>
    exchange.request.headers['sec-fetch-dest'] === 'style' ||
    _.includes([
        'text/css'
    ], getMessageBaseContentType(exchange.response));

const isHTMLExchange = (exchange: SuccessfulExchange) =>
    exchange.request.headers['sec-fetch-dest'] === 'document' ||
    getMessageBaseContentType(exchange.response) === 'text/html';

const isFontExchange = (exchange: SuccessfulExchange) =>
    exchange.request.headers['sec-fetch-dest'] === 'font' ||
    getMessageBaseContentType(exchange.response).startsWith('font/') ||
    _.includes([
        'application/font-woff',
        'application/x-font-woff',
        'application/font-otf',
        'application/font',
        'application/vnd.ms-fontobject',
        'application/x-font-ttf',
        'application/x-font-typetype',
        'application/x-font-opentype',
    ], getMessageBaseContentType(exchange.response));

export const EventCategories = [
    'image',
    'js',
    'css',
    'html',
    'font',
    'data',
    'rtc-data',
    'rtc-media',
    'mutative',
    'websocket',
    'incomplete',
    'aborted',
    'unknown'
] as const;
export type EventCategory = typeof EventCategories[number];

export function getEventCategory(event: HTKEventBase): EventCategory {
    if (event.isHttp()) {
        if (!event.isCompletedExchange()) {
            if (isMutatativeExchange(event)) {
                return 'mutative';
            } else {
                return 'incomplete';
            }
        } else if (!event.isSuccessfulExchange()) {
            return 'aborted';
        } else if (event.isWebSocket()) {
            return 'websocket';
        } else if (isMutatativeExchange(event)) {
            return 'mutative';
        } else if (isImageExchange(event)) {
            return 'image';
        } else if (isJSExchange(event)) {
            return 'js';
        } else if (isCSSExchange(event)) {
            return 'css';
        } else if (isHTMLExchange(event)) {
            return 'html';
        } else if (isFontExchange(event)) {
            return 'font';
        } else if (isDataExchange(event)) {
            return 'data';
        }
    } else if (event.isRTCDataChannel()) {
        return 'rtc-data';
    } else if (event.isRTCMediaTrack()) {
        return 'rtc-media';
    }

    return 'unknown';
};

export function describeEventCategory(category: EventCategory) {
    const categoryColor = getSummaryColor(category);
    const colorName = _.startCase(_.findKey(highlights, (c) => c === categoryColor)!);

    return `${colorName}: ${({
        "mutative": "a request that might affect the server state (unlike a GET request)",
        "incomplete": "an incomplete request",
        "aborted": "an aborted request",
        "image": "a request for an image",
        "js": "a request for JavaScript",
        "css": "a request for CSS",
        "html": "a request for HTML",
        "font": "a request for a font file",
        "data": "an API request",
        "websocket": "a WebSocket stream",
        "rtc-data": "a WebRTC data stream",
        "rtc-media": "a WebRTC media stream",
        "unknown": "an unknown type of request"
    } as const)[category]}`;
}

const highlights = {
    black: '#000',
    grey: '#888',
    red: '#ce3939',
    lightGreen: '#4caf7d',
    brightGreen: '#409309',
    orange: '#ff8c38',
    yellow: '#e9f05b',
    lightBlue: '#2fb4e0',
    darkBlue: '#5a80cc',
    purple: '#6e40aa',
    pink: '#dd3a96'
};

export function getSummaryColor(
    exchangeOrCategory: HttpExchangeView | EventCategory
): string {
    const category = typeof exchangeOrCategory === 'string' ?
        exchangeOrCategory : exchangeOrCategory.category;

    switch (category) {
        case 'incomplete':
        case 'aborted':
            return highlights.black;
        case 'mutative':
            return highlights.red;
        case 'data':
        case 'rtc-data':
            return highlights.purple;
        case 'websocket':
            return highlights.lightBlue;
        case 'image':
            return highlights.lightGreen;
        case 'font':
        case 'rtc-media':
            return highlights.brightGreen;
        case 'js':
            return highlights.orange;
        case 'css':
            return highlights.yellow;
        case 'html':
            return highlights.darkBlue;
        case 'unknown':
            return highlights.grey;
    }
}

export function getStatusColor(status: undefined | 'aborted' | number, theme: Theme): string {
    if (!status || status === 'aborted' || status < 100 || status >= 600) {
        // All odd undefined/unknown cases
        return theme.mainColor;
    } else if (status >= 500) {
        return highlights.red;
    } else if (status >= 400) {
        return highlights.orange;
    } else if (status >= 300) {
        return highlights.darkBlue;
    } else if (status >= 200) {
        return highlights.lightGreen;
    } else if (status === 101) {
        return highlights.lightBlue; // Almost always a websocket, so special case to match
    } else if (status >= 100) {
        return highlights.grey;
    }

    // Anything else weird.
    return highlights.black;
}

export function getWebSocketCloseColor(closeCode: undefined | 'aborted' | number, theme: Theme): string {
    // See https://datatracker.ietf.org/doc/html/rfc6455#section-7.4.1 for definitions
    if (!closeCode || closeCode === 'aborted') {
        // All odd undefined/unknown cases
        return theme.mainColor;
    } else if (closeCode === 1000 || closeCode === 1001) {
        // Closed OK or due to clean client/server shutdown
        return highlights.lightGreen;
    } else if (closeCode >= 1002 && closeCode <= 3000) {
        // Closed due to some protocol errors
        return highlights.red;
    } else if (closeCode >= 3000) {
        return highlights.orange;
    }

    // Anything else weird.
    return highlights.black;
}

export function getMethodColor(method: string): string {
    if (method === 'GET') {
        return highlights.lightGreen;
    } else if (method === 'POST') {
        return highlights.orange;
    } else if (method === 'DELETE') {
        return highlights.red;
    } else if (method === 'PUT') {
        return highlights.purple;
    } else if (method === 'PATCH') {
        return highlights.pink;
    } else if (method === 'HEAD') {
        return highlights.darkBlue;
    } else if (method === 'OPTIONS') {
        return highlights.lightBlue;
    } else {
        return highlights.grey;
    }
}