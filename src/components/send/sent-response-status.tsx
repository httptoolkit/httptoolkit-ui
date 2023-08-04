import * as React from 'react';

import { Theme } from '../../styles';

import { getStatusColor } from '../../model/events/categorization';
import { getStatusMessage } from '../../model/http/http-docs';
import { getReadableSize } from '../../model/events/bodies';
import { SuccessfulExchange } from '../../model/http/exchange';

import { SendCardSection } from './send-card-section';
import { Pill } from '../common/pill';
import { DurationPill } from '../common/duration-pill';

export const ResponseStatusSection = (props: {
    exchange: SuccessfulExchange,
    theme: Theme
}) => {
    const response = props.exchange.response;

    return <SendCardSection
        collapsed={false}
    >
        <header>
            <Pill
                color={getStatusColor(response.statusCode, props.theme)}
            >
                { response.statusCode }: { response.statusMessage || getStatusMessage(response.statusCode) }
            </Pill>
            <Pill title="The size of the raw encoded response body">
                { getReadableSize(response.body.encoded.byteLength) }
            </Pill>
            <DurationPill timingEvents={props.exchange.timingEvents} />
        </header>
    </SendCardSection>;
}