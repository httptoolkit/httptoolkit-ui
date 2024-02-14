import * as React from 'react';

import { Theme, styled } from '../../styles';

import { getStatusColor } from '../../model/events/categorization';
import { getStatusMessage } from '../../model/http/http-docs';
import { getReadableSize } from '../../model/events/bodies';
import { SuccessfulExchange } from '../../model/http/exchange';

import { SendCardSection } from './send-card-section';
import { Pill } from '../common/pill';
import { DurationPill } from '../common/duration-pill';

const ResponseStatusSectionCard = styled(SendCardSection)`
    padding-top: 7px;
    padding-bottom: 7px;
    flex-shrink: 0;

    > header {
        flex-direction: row;
        justify-content: flex-start;
    }
`;

export const ResponseStatusSection = (props: {
    exchange: SuccessfulExchange,
    theme: Theme
}) => {
    const response = props.exchange.response;

    return <ResponseStatusSectionCard
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
        </header>
    </ResponseStatusSectionCard>;
}