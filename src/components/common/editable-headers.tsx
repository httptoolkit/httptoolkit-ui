import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';

import { Headers } from '../../types';
import { HEADER_NAME_PATTERN } from '../../model/http/http-docs';

import { EditablePairs, Pair, PairsArray } from './editable-pairs';

export type HeadersArray = Array<Pick<Pair, 'key' | 'value'>>;

export const headersToHeadersArray = (headers: Headers): HeadersArray =>
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

export const headersArrayToHeaders = (headers: HeadersArray): Headers =>
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
    headers.map(({ key, value }) => ({
        key,
        value,
        disabled: key.startsWith(':')
    }));

const stripInvalidLeadingColons = (headers: PairsArray): HeadersArray =>
headers.map(({ key, value, disabled }) => ({
    key: !disabled && key.startsWith(':')
        ? key.slice(1) // Strip leading colons on editable header keys
        : key,
    value
}));

interface EditableHeadersProps {
    headers: HeadersArray;
    onChange: (headers: HeadersArray) => void;

    // It's unclear whether you're strictly allowed completely empty header values, but it's definitely
    // not recommended and poorly supported. By default we disable it except for special use cases.
    allowEmptyValues?: boolean;
}

export const EditableHeaders = observer((props: EditableHeadersProps) => {
    const { headers, onChange, allowEmptyValues } = props;

    return <EditablePairs
        pairs={withH2HeadersDisabled(headers)}
        onChange={(pairs) => onChange(stripInvalidLeadingColons(pairs))}

        allowEmptyValues={allowEmptyValues}

        keyPattern={HEADER_NAME_PATTERN}
        keyTitle="Header names must contain only alphanumeric characters and !#$%&'*+-.^_`|~ symbols"

        keyPlaceholder='Header name'
        valuePlaceholder='Header value'
    />;
});