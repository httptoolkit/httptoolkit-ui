import * as React from 'react';

import { styled } from '../../styles';
import { WarningIcon } from '../../icons';
import { unreachableCheck } from '../../util/error';
import { logError } from '../../errors';

import {
    ErrorType,
    wasNotForwarded,
    wasServerIssue
} from '../../model/http/error-types';

import { SendCardSection } from './send-card-section';
import { ContentMonoValue } from '../common/text-content';

const ExplanationBlock = styled.p`
    margin-bottom: 10px;
    line-height: 1.3;
`;

const FailureBlock = styled(ExplanationBlock)`
    font-weight: bold;
`;

export const SentResponseError = (props: {
    errorType: ErrorType,
    errorMessage: string | undefined
}) => {
    const { errorType, errorMessage } = props;

    if (
        !wasNotForwarded(errorType) &&
        !wasServerIssue(errorType)
    ) {
        logError(`Unexpected Send error type: ${errorType}`);
    }

    return <SendCardSection
        ariaLabel='HTTP failure section'
        collapsed={false}
    >
        <header>
            <h1>
                Request Failure
            </h1>
        </header>
        <FailureBlock>
            <WarningIcon /> {
                wasNotForwarded(errorType)
                    ? 'This request was not sent successfully'
                : wasServerIssue(errorType)
                    ? 'This response was not received successfully'
                : `The request failed because of an unexpected error: ${errorType}`
            } <WarningIcon />
        </FailureBlock>
        {
            wasNotForwarded(errorType)
                ? <ExplanationBlock>
                    The upstream server {
                        errorType === 'wrong-host'
                            ? 'responded with an HTTPS certificate for the wrong hostname'
                        : errorType === 'expired'
                            ? 'has an expired HTTPS certificate'
                        : errorType === 'not-yet-valid'
                            ? 'has an HTTPS certificate with a start date in the future'
                        : errorType === 'untrusted'
                            ? 'has an untrusted HTTPS certificate'
                        : errorType === 'tls-error'
                            ? 'failed to complete a TLS handshake'
                        : errorType === 'host-unreachable'
                            ? 'was not reachable on your network connection'
                        : errorType === 'host-not-found' || errorType === 'dns-error'
                            ? 'hostname could be not found'
                        : errorType === 'connection-refused'
                            ? 'refused the connection'
                        : unreachableCheck(errorType)
                    }, so HTTP Toolkit did not send the request.
                </ExplanationBlock>
            : wasServerIssue(errorType)
                ? <ExplanationBlock>
                    The upstream request failed because {
                        errorType === 'connection-reset'
                            ? 'the connection to the server was reset'
                        : errorType === 'server-unparseable'
                            ? 'the response from the server was unparseable'
                        : errorType === 'server-timeout'
                            ? 'of a timeout waiting for a response from the server'
                        : unreachableCheck(errorType)
                    }.
                </ExplanationBlock>
            : <ExplanationBlock>
                It's not clear what's gone wrong here, but for some reason HTTP Toolkit
                couldn't successfully and/or securely complete this request. This might be an
                intermittent issue, and may be resolved by retrying the request.
            </ExplanationBlock>
        }
        { !!errorMessage &&
            <ContentMonoValue>{ errorMessage }</ContentMonoValue>
        }
    </SendCardSection>
}