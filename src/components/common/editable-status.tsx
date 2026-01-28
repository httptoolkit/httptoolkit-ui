import * as _ from 'lodash';
import * as React from 'react';

import { HttpVersion } from '../../types';
import { styled } from '../../styles';

import { TextInput } from './inputs';
import { getStatusMessage } from '../../model/http/http-docs';

const StatusContainer = styled.div`
    margin-top: 5px;

    display: flex;
    flex-direction: row;
    align-items: stretch;

    > :not(:last-child) {
        margin-right: 5px;
    }

    > :last-child {
        flex-grow: 1;
    }
`;

function isDefaultMessage(statusMessage: string, statusCode: number | undefined) {
    return statusMessage.toLowerCase() === getStatusMessage(statusCode).toLowerCase()
}

export const EditableStatus = (props: {
    className?: string,
    httpVersion: HttpVersion,
    statusCode: number | undefined,
    statusMessage: string | undefined,
    onChange: (statusCode: number | undefined, statusMessage: string | undefined) => void
}) => {
    const { statusCode } = props;

    // Undefined status message = use default. Note that the status
    // message can still be shown as _empty_, just not undefined.
    const statusMessage = props.statusMessage === undefined || props.httpVersion >= 2
        ? getStatusMessage(statusCode)
        : props.statusMessage;

    return <StatusContainer className={props.className}>
        <TextInput
            type='number'
            min='100'
            max='999'
            invalid={!statusCode}
            value={statusCode}
            onChange={(event) => {
                let newStatusCode = (event.target.value !== '')
                    ? parseInt(event.target.value, 10)
                    : undefined;

                if (_.isNaN(newStatusCode)) return;

                // If the status message was the default message, update it to
                // match the new status code
                const newStatusMessage = isDefaultMessage(statusMessage, statusCode)
                    ? undefined
                    : props.statusMessage;

                props.onChange(newStatusCode, newStatusMessage);
            }}
        />

        <TextInput
            disabled={props.httpVersion >= 2}
            value={statusMessage}
            onChange={(event) => {
                let newMessage: string | undefined = event.target.value;

                if (isDefaultMessage(newMessage, statusCode)) {
                    newMessage = undefined;
                }

                props.onChange(statusCode, newMessage);
            }}
        />
    </StatusContainer>;
}