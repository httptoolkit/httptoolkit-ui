import * as _ from 'lodash';
import * as React from 'react';

import { styled } from '../../styles';

import { TextInput } from './inputs';
import { getStatusMessage } from '../../model/http-docs';

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

export const EditableStatus = (props: {
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

    return <StatusContainer>
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

                // Empty status messages reset to default when the status is changed:
                const newStatusMessage = props.statusMessage || undefined;
                props.onChange(newStatusCode, newStatusMessage);
            }}
        />

        <TextInput
            value={statusMessage}
            onChange={(event) => {
                let newMessage: string | undefined = event.target.value;

                if (newMessage === getStatusMessage(statusCode)) {
                    newMessage = undefined;
                }

                props.onChange(statusCode, newMessage);
            }}
        />
    </StatusContainer>;
}