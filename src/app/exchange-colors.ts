import * as _ from 'lodash';

import { HttpExchange } from "./model/store";

type CompletedExchange = Required<HttpExchange>;

// Simplify the content type as much as we can, without throwing any errors
const getBaseContentType = (requestOrResponse: { headers: { [key: string]: string } }) =>
    (requestOrResponse.headers['content-type'] || '').split(';')[0].split('+')[0];

const isCompletedExchange = (exchange: HttpExchange): exchange is CompletedExchange =>
    !!exchange.response;

const isMutatativeExchange = (exchange: HttpExchange) => _.includes([
    'POST',
    'PATCH',
    'PUT',
    'DELETE'
], exchange.request.method);

const isImageExchange = (exchange: CompletedExchange) =>
    getBaseContentType(exchange.response).startsWith('image/');

const isDataExchange = (exchange: CompletedExchange) =>
    _.includes([
        'application/json',
        'application/xml',
        'multipart/form-data',
        'application/x-www-form-urlencoded',
        'application/x-protobuf'
    ], getBaseContentType(exchange.response));

const isJSExchange = (exchange: CompletedExchange) =>
    _.includes([
        'text/javascript',
        'application/javascript',
        'application/x-javascript',
        'application/ecmascript'
    ], getBaseContentType(exchange.response));

const isCSSExchange = (exchange: CompletedExchange) =>
_.includes([
    'text/css',
    'application/javascript',
    'application/x-javascript',
    'application/ecmascript'
], getBaseContentType(exchange.response));

const isHTMLExchange = (exchange: CompletedExchange) =>
    getBaseContentType(exchange.response) === 'text/html';

const isFontExchange = (exchange: CompletedExchange) =>
    getBaseContentType(exchange.response).startsWith('font/') ||
    _.includes([
        'application/font-woff',
        'application/x-font-woff',
        'application/font-otf',
        'application/font',
        'application/vnd.ms-fontobject',
        'application/x-font-ttf',
        'application/x-font-typetype',
        'application/x-font-opentype',
    ], getBaseContentType(exchange.response));

export function getExchangeSummaryColour(exchange: HttpExchange): string {
    if (!isCompletedExchange(exchange)) {
        if (isMutatativeExchange(exchange)) {
            return '#ce3939'; // red
        } else {
            return '#000'; // black
        }
    } else if (isImageExchange(exchange)) {
        return '#4caf7d'; // green
    } else if (isJSExchange(exchange)) {
        return '#ff8c38'; // orange
    } else if (isCSSExchange(exchange)) {
        return '#e9f05b'; // yellow
    } else if (isHTMLExchange(exchange)) {
        return '#2fb4e0'; // light blue
    } else if (isFontExchange(exchange)) {
        return '#6e40aa'; // dark blue
    } else if (isDataExchange(exchange)) {
        return '#6e40aa'; // purple
    } else if (isMutatativeExchange(exchange)) {
        return '#ce3939'; // red
    } else {
        return '#888'; // grey
    }
};

export function getStatusColor(status: undefined | number): string {
    if (!status || status < 100 || status >= 600) {
        // All odd undefined/unknown cases
        return '#000';
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