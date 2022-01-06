import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';

import { Headers } from '../../types';
import { HEADER_NAME_PATTERN } from '../../model/http/http-docs';

import { EditablePairs, Pair, PairsArray } from './editable-pairs';

export type HeadersArray = Array<Pick<Pair, 'key' | 'value'>>;

const headersToHeadersArray = (headers: Headers): HeadersArray =>
    Object.entries(headers || {}).reduce(
        (acc: HeadersArray, [key, value]) => {
            if (_.isArray(value)) {
                acc = acc.concat(value.map(value => ({ key, value })))
            } else {
                acc.push({ key, value: value || '' });
            }
            return acc;
        }, []
    );

const headersArrayToHeaders = (headers: HeadersArray): Headers =>
    headers.reduce((headersObj: { [k: string]: string | string[] }, { key, value }) => {
        const headerName = key.toLowerCase();

        const existingValue = headersObj[headerName];
        if (existingValue === undefined) {
            headersObj[headerName] = value;
        } else if (_.isString(existingValue)) {
            headersObj[headerName] = [existingValue, value];
        } else {
            existingValue.push(value);
        }
        return headersObj;
    }, {});

const withH2HeadersDisabled = (headers: HeadersArray): PairsArray =>
    headers.map(({ key, value }) =>
        key.startsWith(':')
        ? { key, value, disabled: true }
        : { key, value }
    );

const normalizeHeaderInput = (headers: PairsArray): HeadersArray =>
    // Lowercase header keys, and strip any leading colons - HTTP/2 headers should never be entered raw
    headers.map(({ key, value, disabled }) => ({
        key: !disabled && key.startsWith(':')
            ? key.slice(1).toLowerCase()
            : key.toLowerCase(),
        value
    }));

interface EditableHeadersProps<R = Headers> {
    headers: Headers;
    onChange: (headers: R) => void;
    convertResult?: (headers: Headers) => R;

    // It's unclear whether you're strictly allowed completely empty header values, but it's definitely
    // not recommended and poorly supported. By default we disable it except for special use cases.
    allowEmptyValues?: boolean;
}

export const EditableHeaders = observer(<R extends unknown>(props: EditableHeadersProps<R>) => {
    const { headers, onChange, allowEmptyValues, convertResult } = props;

    return <EditablePairs<R>
        pairs={withH2HeadersDisabled(headersToHeadersArray(headers))}
        onChange={onChange}
        transformInput={normalizeHeaderInput}
        convertResult={(pairs: PairsArray) =>
            convertResult
            ? convertResult(headersArrayToHeaders(pairs))
            : headersArrayToHeaders(pairs) as unknown as R
        }

        allowEmptyValues={allowEmptyValues}

        keyPattern={HEADER_NAME_PATTERN}
        keyTitle="Header names must contain only alphanumeric characters and !#$%&'*+-.^_`|~ symbols"

        keyPlaceholder='Header name'
        valuePlaceholder='Header value'
    />;
});