import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { TimingEvents } from '../../types';
import { Theme, styled } from '../../styles';
import { Icon } from '../../icons';
import { getReadableSize } from '../../util/buffer';

import { getStatusColor } from '../../model/events/categorization';
import { getStatusMessage } from '../../model/http/http-docs';
import { CompletedExchange, SuccessfulExchange } from '../../model/http/exchange';
import { ErrorType } from '../../model/http/error-types';

import { SendCardSection } from './send-card-section';
import { Pill, PillButton } from '../common/pill';
import { DurationPill } from '../common/duration-pill';
import { IconButton } from '../common/icon-button';

const ResponseStatusSectionCard = styled(SendCardSection)`
    padding-top: 7px;
    padding-bottom: 7px;
    flex-shrink: 0;
    flex-grow: 0;

    z-index: 1;
    box-shadow: 0 2px 3px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha});

    > header {
        flex-direction: row;
        justify-content: flex-start;
    }
`;

const ShowRequestButton = styled(IconButton).attrs(() => ({
    icon: ['fas', 'search'],
    title: 'Jump to this request on the View page'
}))`
    padding: 3px 10px;
    margin-right: -10px;

    margin-left: auto;
`;

export const ResponseStatusSection = (props: {
    exchange: SuccessfulExchange,
    showRequestOnViewPage?: () => void,
    theme: Theme
}) => {
    const response = props.exchange.response;

    return <ResponseStatusSectionCard
        className='ignores-expanded' // This always shows, even if something is expanded
        ariaLabel='Response status section'
        collapsed={false}
        headerAlignment='left'
    >
        <header>
            <Pill
                color={getStatusColor(response.statusCode, props.theme)}
            >
                { response.statusCode }: { response.statusMessage || getStatusMessage(response.statusCode) }
            </Pill>
            <DurationPill timingEvents={props.exchange.timingEvents} />
            <Pill title="The size of the raw encoded response body">
                { getReadableSize(response.body.encoded.byteLength) }
            </Pill>
            { props.showRequestOnViewPage &&
                <ShowRequestButton onClick={props.showRequestOnViewPage} />
            }
        </header>
    </ResponseStatusSectionCard>;
}

const AbortButton = styled(PillButton)`
    margin-left: auto;
    svg {
        margin-right: 5px;
    }
`;

export const PendingResponseStatusSection = observer((props: {
    timingEvents?: Partial<TimingEvents>,
    abortRequest?: () => void,
    theme: Theme,
}) => {
    return <ResponseStatusSectionCard
        className='ignores-expanded' // This always shows, even if something is expanded
        ariaLabel='Response status section'
        collapsed={false}
        headerAlignment='left'
    >
        <header>
            <Pill
                color={getStatusColor(undefined, props.theme)}
                // Spacing here is intended to be approx the same as "200: OK" to avoid
                // too much layout churn between pending & completed requests
            >
                &nbsp;&nbsp;&nbsp;&nbsp;...&nbsp;&nbsp;&nbsp;&nbsp;
            </Pill>
            <DurationPill timingEvents={props.timingEvents ?? {}} />

            { props.abortRequest &&
                <AbortButton
                    color={props.theme.popColor}
                    onClick={props.abortRequest}
                >
                    <Icon icon={['fas', 'times']} />
                    Cancel request
                </AbortButton>
            }
        </header>
    </ResponseStatusSectionCard>;
});

export const FailedResponseStatusSection = (props: {
    exchange: CompletedExchange,
    errorType: ErrorType,
    showRequestOnViewPage?: () => void,
    theme: Theme
}) => {
    return <ResponseStatusSectionCard
        className='ignores-expanded' // This always shows, even if something is expanded
        ariaLabel='Response status section'
        collapsed={false}
        headerAlignment='left'
    >
        <header>
            <Pill
                color={getStatusColor('aborted', props.theme)}
            >
                Failed: { _.startCase(props.errorType) }
            </Pill>
            <DurationPill timingEvents={props.exchange.timingEvents} />

            { props.showRequestOnViewPage &&
                <ShowRequestButton onClick={props.showRequestOnViewPage} />
            }
        </header>
    </ResponseStatusSectionCard>;
}