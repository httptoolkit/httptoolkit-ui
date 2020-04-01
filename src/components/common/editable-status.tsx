import * as _ from 'lodash';
import * as React from 'react';

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

function isDefaultMessage(statusMessage: string, statusCode: number | string) {
    return statusMessage.toLowerCase() === getStatusMessage(statusCode).toLowerCase()
}

export const EditableStatus = (props: {
    className?: string,
    statusCode: number | '',
    statusMessage: string | undefined,
    onChange: (statusCode: number | '', statusMessage: string | undefined) => void
}) => {
    const { statusCode } = props;

    // Undefined status message = use default. Note that the status
    // message can still be shown as _empty_, just not undefined.
    const statusMessage = props.statusMessage === undefined
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
                    : '' as const;

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