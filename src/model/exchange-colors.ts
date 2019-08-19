import * as _ from 'lodash';

import { Omit, InputMessage, InputResponse } from '../types';
import { getBaseContentType } from './content-types';
import { Theme } from '../styles';
import { HttpExchange } from './exchange';

type MinimalExchange = Pick<HttpExchange, 'request' | 'response'>;
type CompletedExchange = Required<MinimalExchange>;
type SuccessfulExchange = Omit<CompletedExchange, 'response'> & { response: InputResponse };

export const getRequestBaseContentType = (requestOrResponse: InputMessage) =>
    getBaseContentType(requestOrResponse.headers['content-type']);

const isCompletedExchange = (exchange: MinimalExchange): exchange is CompletedExchange =>
    !!exchange.response;

const isSuccessfulExchange = (exchange: any): exchange is SuccessfulExchange =>
    isCompletedExchange(exchange) && exchange.response !== 'aborted';

const isMutatativeExchange = (exchange: MinimalExchange) => _.includes([
    'POST',
    'PATCH',
    'PUT',
    'DELETE'
], exchange.request.method);

const isImageExchange = (exchange: SuccessfulExchange) =>
    getRequestBaseContentType(exchange.response).startsWith('image/');

const isDataExchange = (exchange: SuccessfulExchange) =>
    _.includes([
        'application/json',
        'application/xml',
        'application/rss',
        'text/xml',
        'text/json',
        'multipart/form-data',
        'application/x-www-form-urlencoded',
        'application/x-protobuf'
    ], getRequestBaseContentType(exchange.response));

const isJSExchange = (exchange: SuccessfulExchange) =>
    _.includes([
        'text/javascript',
        'application/javascript',
        'application/x-javascript',
        'application/ecmascript'
    ], getRequestBaseContentType(exchange.response));

const isCSSExchange = (exchange: SuccessfulExchange) =>
    _.includes([
        'text/css'
    ], getRequestBaseContentType(exchange.response));

const isHTMLExchange = (exchange: SuccessfulExchange) =>
    getRequestBaseContentType(exchange.response) === 'text/html';

const isFontExchange = (exchange: SuccessfulExchange) =>
    getRequestBaseContentType(exchange.response).startsWith('font/') ||
    _.includes([
        'application/font-woff',
        'application/x-font-woff',
        'application/font-otf',
        'application/font',
        'application/vnd.ms-fontobject',
        'application/x-font-ttf',
        'application/x-font-typetype',
        'application/x-font-opentype',
    ], getRequestBaseContentType(exchange.response));

export function getExchangeCategory(exchange: MinimalExchange) {
    if (!isCompletedExchange(exchange)) {
        if (isMutatativeExchange(exchange)) {
            return 'mutative'; // red
        } else {
            return 'incomplete';
        }
    } else if (!isSuccessfulExchange(exchange)) {
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

export type ExchangeCategory = ReturnType<typeof getExchangeCategory>;

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