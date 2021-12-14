import * as _ from 'lodash';

import { ExchangeMessage } from '../../types';
import { lastHeader } from '../../util';
import { Theme } from '../../styles';

import { getBaseContentType } from './content-types';
import { HttpExchange, SuccessfulExchange } from './exchange';

export const getMessageBaseAcceptTypes = (message: ExchangeMessage) =>
    (lastHeader(message.headers['accept'])?.split(',') || [])
        .map((acceptType) => getBaseContentType(acceptType));

export const getMessageBaseContentType = (message: ExchangeMessage) =>
    getBaseContentType(lastHeader(message.headers['content-type']));

const isMutatativeExchange = (exchange: HttpExchange) => _.includes([
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

export const ExchangeCategories = [
    'image',
    'js',
    'css',
    'html',
    'font',
    'data',
    'mutative',
    'incomplete',
    'aborted',
    'unknown'
] as const;
export type ExchangeCategory = typeof ExchangeCategories[number];

export function getExchangeCategory(exchange: HttpExchange): ExchangeCategory {
    if (!exchange.isCompletedExchange()) {
        if (isMutatativeExchange(exchange)) {
            return 'mutative';
        } else {
            return 'incomplete';
        }
    } else if (!exchange.isSuccessfulExchange()) {
        return 'aborted';
    } else if (isMutatativeExchange(exchange)) {
        return 'mutative';
    } else if (isImageExchange(exchange)) {
        return 'image';
    } else if (isJSExchange(exchange)) {
        return 'js';
    } else if (isCSSExchange(exchange)) {
        return 'css';
    } else if (isHTMLExchange(exchange)) {
        return 'html';
    } else if (isFontExchange(exchange)) {
        return 'font';
    } else if (isDataExchange(exchange)) {
        return 'data';
    } else {
        return 'unknown';
    }
};

export function describeExchangeCategory(category: ExchangeCategory) {
    const categoryColour = getExchangeSummaryColour(category);
    const colourName = _.startCase(_.findKey(highlights, (c) => c === categoryColour)!);

    return `${colourName}: ${({
        "mutative": "a request that might affect the server state (unlike a GET request)",
        "incomplete": "an incomplete request",
        "aborted": "an aborted request",
        "image": "a request for an image",
        "js": "a request for JavaScript",
        "css": "a request for CSS",
        "html": "a request for HTML",
        "font": "a request for a font file",
        "data": "an API request",
        "unknown": "an unknown type of request"
    } as const)[category]}`;
}

const isExchange = (maybeExchange: any): maybeExchange is HttpExchange =>
    maybeExchange.request && maybeExchange.category;

const highlights = {
    black: '#000',
    grey: '#888',
    red: '#ce3939',
    green: '#4caf7d',
    orange: '#ff8c38',
    yellow: '#e9f05b',
    lightBlue: '#2fb4e0',
    darkBlue: '#5a80cc',
    purple: '#6e40aa',
    pink: '#dd3a96'
};

export function getExchangeSummaryColour(exchangeOrCategory: HttpExchange | ExchangeCategory): string {
    const category = isExchange(exchangeOrCategory) ?
        exchangeOrCategory.category : exchangeOrCategory;

    switch (category) {
        case 'incomplete':
        case 'aborted':
            return highlights.black;
        case 'mutative':
            return highlights.red;
        case 'image':
            return highlights.green;
        case 'js':
            return highlights.orange;
        case 'css':
            return highlights.yellow;
        case 'html':
            return highlights.lightBlue;
        case 'font':
            return highlights.darkBlue;
        case 'data':
            return highlights.purple;
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
        return highlights.green;
    } else if (status >= 100) {
        return highlights.grey;
    }

    // Anything else weird.
    return highlights.black;
}

export function getMethodColor(method: string): string {
    if (method === 'GET') {
        return highlights.green;
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