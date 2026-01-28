import * as _ from 'lodash';
import * as React from 'react';
import { action, observable, reaction, runInAction } from 'mobx';
import { disposeOnUnmount, observer } from 'mobx-react';

import { RawHeaders } from '../../types';
import { HEADER_NAME_PATTERN } from '../../model/http/headers';

import { EditablePairs, PairsArray } from './editable-pairs';

const tupleArrayToPairsArray = (headers: RawHeaders): PairsArray =>
    headers.map(([key, value]) => ({ key, value }));

const withH2HeadersDisabled = (headers: PairsArray): PairsArray =>
    headers.map(({ key, value }) =>
        key.startsWith(':')
        ? { key, value, disabled: true }
        : { key, value }
    );

const rawHeadersAsEditablePairs = (rawHeaders: RawHeaders) => {
    return withH2HeadersDisabled(tupleArrayToPairsArray(rawHeaders));
};

const outputToRawHeaders = (output: PairsArray): RawHeaders =>
    output.map(({ key, value }) => [key, value]);

const stripPseudoHeaders = (headers: PairsArray): PairsArray =>
    // Strip leading colons - HTTP/2 headers should never be entered raw (but don't lower case)
    headers.map(({ key, value, disabled }) => ({
        key: !disabled && key.startsWith(':')
            ? key.slice(1)
            : key,
        value,
        disabled
    }));

const stripPseudoHeadersAndLowercase = (headers: PairsArray): PairsArray =>
    // Lowercase header keys, and strip any leading colons - HTTP/2 headers should never be entered raw
    headers.map(({ key, value, disabled }) => ({
        key: !disabled && key.startsWith(':')
            ? key.slice(1).toLowerCase()
            : key.toLowerCase(),
        value,
        disabled
    }));

interface EditableRawHeadersProps {
    headers: RawHeaders;
    onChange: (headers: RawHeaders) => void;

    // It's unclear whether you're strictly allowed completely empty header values, but it's definitely
    // not recommended and poorly supported. By default we disable it except for special use cases.
    allowEmptyValues?: boolean;

    // By default, we lowercase headers. This isn't strictly required, but it's generally clearer,
    // simpler, and semantically meaningless. HTTP/2 is actually even forced lowercase on the wire.
    // Nonetheless, sometimes (breakpoints) you want to ignore that and edit with case regardless
    // because the real raw headers have existing cases and otherwise it's weird:
    preserveKeyCase?: boolean;
}

export const EditableRawHeaders = observer((
    props: EditableRawHeadersProps
) => {
    const { headers, onChange, allowEmptyValues, preserveKeyCase } = props;

    return <EditablePairs<RawHeaders>
        pairs={rawHeadersAsEditablePairs(headers)}
        onChange={onChange}
        transformInput={
            preserveKeyCase
            ? stripPseudoHeaders
            : stripPseudoHeadersAndLowercase
        }
        convertResult={outputToRawHeaders}

        allowEmptyValues={allowEmptyValues}

        keyValidation={HEADER_NAME_PATTERN}
        keyTitle="Header names must contain only alphanumeric characters and !#$%&'*+-.^_`|~ symbols"

        keyPlaceholder='Header name'
        valuePlaceholder='Header value'
    />;
});

interface EditableHeadersProps<T> {
    headers: T;

    convertToRawHeaders: (input: T) => RawHeaders;
    convertFromRawHeaders: (headers: RawHeaders) => T;

    onChange: (headers: T) => void;
    onInvalidState?: () => void;

    // It's unclear whether you're strictly allowed completely empty header values, but it's definitely
    // not recommended and poorly supported. By default we disable it except for special use cases.
    allowEmptyValues?: boolean;
}

// Editable headers acts as a wrapper around the raw header pair modification, converting to and from other
// formats (most commonly header objects, rather than arrays) whilst avoiding unnecessary updates that
// cause churn in the UI due to unrepresentable states in that format (e.g. duplicate headers that aren't
// directly next to each other). This allows you to edit as if the data was in raw header format, but
// get different data live as it changes, without collapsing to that state until later.
@observer
export class EditableHeaders<T> extends React.Component<EditableHeadersProps<T>> {

    @observable
    private rawHeaders: RawHeaders = this.props.convertToRawHeaders(this.props.headers);

    private output: T = this.props.headers;

    componentDidMount() {
        // Watch the input, but only update our state if its materially different
        // to the last output we returned.
        disposeOnUnmount(this, reaction(
            () => this.props.headers,
            (input) => {
                if (!_.isEqual(input, this.output)) {
                    const newInput = this.props.convertToRawHeaders(input);
                    runInAction(() => {
                        this.rawHeaders = newInput;
                    });
                }
            }
        ));
    }

    @action.bound
    onChangeRawHeaders(rawHeaders: RawHeaders) {
        this.rawHeaders = rawHeaders;

        const { allowEmptyValues, convertFromRawHeaders, onChange, onInvalidState } = this.props;

        if (allowEmptyValues) {
            this.output = convertFromRawHeaders(rawHeaders);
            onChange(this.output);
        } else {
            if (rawHeaders.some((([_, value]) => !value))) return onInvalidState?.();
            if (rawHeaders.some(([key]) => !key)) return onInvalidState?.();

            this.output = convertFromRawHeaders(rawHeaders);
            onChange(this.output);
        }
    }

    render() {
        const { allowEmptyValues } = this.props;
        const { rawHeaders, onChangeRawHeaders } = this;

        return <EditableRawHeaders
            headers={rawHeaders}
            onChange={onChangeRawHeaders}
            allowEmptyValues={allowEmptyValues}
        />;
    }

}