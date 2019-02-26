import * as React from 'react';

import { HtkResponse, Omit } from '../../types';
import { ObservablePromise } from '../../util';
import { Theme } from '../../styles';

import { ApiExchange } from '../../model/openapi/openapi-types';
import { getStatusColor } from '../../exchange-colors';

import { Pill } from '../common/pill';
import { HeaderDetails } from './header-details';
import {
    ExchangeCard,
    ContentMonoValue,
    ContentLabelBlock,
    ExchangeCardProps
} from './exchange-card';

interface ExchangeResponseCardProps extends Omit<ExchangeCardProps, 'children'>  {
    theme: Theme;
    response: HtkResponse;
    apiExchange: ObservablePromise<ApiExchange> | undefined;
}

export const ExchangeResponseCard = (props: ExchangeResponseCardProps) => {
    const { response, theme } = props;

    return <ExchangeCard {...props} direction='left'>
        <header>
            <Pill color={getStatusColor(response.statusCode, theme!)}>{
                response.statusCode
            }</Pill>
            <h1>Response</h1>
        </header>
        <div>
            <ContentLabelBlock>Status</ContentLabelBlock>
            <ContentMonoValue>
                {response.statusCode}: {response.statusMessage}
            </ContentMonoValue>

            <ContentLabelBlock>Headers</ContentLabelBlock>
            <ContentMonoValue>
                <HeaderDetails headers={response.headers} />
            </ContentMonoValue>
        </div>
    </ExchangeCard>;
}