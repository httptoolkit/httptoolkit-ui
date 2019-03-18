import * as _ from 'lodash';
import { CompletedRequest, CompletedResponse } from 'mockttp';

import { Omit } from './types';
import { getBaseContentType } from './content-types';
import { Theme } from './styles';
import { HttpExchange } from './model/exchange';

type MinimalExchange = Pick<HttpExchange, 'request' | 'response'>;
type MinimalMessage = CompletedRequest | CompletedResponse;
type CompletedExchange = Required<MinimalExchange>;
type SuccessfulExchange = Omit<CompletedExchange, 'response'> & { response: CompletedResponse };

export const getRequestBaseContentType = (requestOrResponse: MinimalMessage) =>
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

export function getExchangeSummaryColour(exchangeOrCategory: HttpExchange | ExchangeCategory): string {
    const category = isExchange(exchangeOrCategory) ?
        exchangeOrCategory.category : exchangeOrCategory;

    switch (category) {
        case 'incomplete':
        case 'aborted':
            return '#000'; // black
        case 'mutative':
            return '#ce3939'; // red
        case 'image':
            return '#4caf7d'; // green
        case 'js':
            return '#ff8c38'; // orange
        case 'css':
            return '#e9f05b'; // yellow
        case 'html':
            return '#2fb4e0'; // light blue
        case 'font':
            return '#6e40aa'; // dark blue
        case 'data':
            return '#6e40aa'; // purple
        case 'unknown':
            return '#888'; // grey
    }
}

export function getStatusColor(status: undefined | 'aborted' | number, theme: Theme): string {
    if (!status || status === 'aborted' || status < 100 || status >= 600) {
        // All odd undefined/unknown cases
        return theme.mainColor;
    } else if (status >= 500) {
        return '#ce3939';
    } else if (status >= 400) {
        return '#f1971f';
    } else if (status >= 300) {
        return '#5a80cc';
    } else if (status >= 200) {
        return '#4caf7d';
    } else if (status >= 100) {
        return '#888';
    }

    // Anything else weird.
    return '#000';
}