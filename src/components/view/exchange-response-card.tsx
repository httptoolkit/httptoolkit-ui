import * as React from 'react';
import { observer } from 'mobx-react';
import { get } from 'typesafe-get';

import { HtkResponse, Omit } from '../../types';
import { Theme, styled } from '../../styles';

import { ApiExchange } from '../../model/openapi/openapi';
import { getStatusColor } from '../../exchange-colors';

import { Pill } from '../common/pill';
import { HeaderDetails } from './header-details';
import {
    ExchangeCard,
    ContentMonoValue,
    ContentLabelBlock,
    ExchangeCardProps,
    ContentLabel,
    ExchangeCollapsibleSummary,
    ExchangeCollapsibleBody
} from './exchange-card';
import { CollapsibleSection } from '../common/collapsible-section';
import { ExternalContent } from '../common/external-content';

interface ExchangeResponseCardProps extends Omit<ExchangeCardProps, 'children'>  {
    theme: Theme;
    response: HtkResponse;
    apiExchange: ApiExchange | undefined;
}

export const ExchangeResponseCard = observer((props: ExchangeResponseCardProps) => {
    const { response, theme, apiExchange } = props;

    const responseDescription = get(
        apiExchange, 'response', 'description'
    );

    return <ExchangeCard {...props} direction='left'>
        <header>
            <Pill color={getStatusColor(response.statusCode, theme!)}>{
                response.statusCode
            }</Pill>
            <h1>Response</h1>
        </header>

        <div>
            <CollapsibleSection>
                <ExchangeCollapsibleSummary>
                    <ContentLabel>Status:</ContentLabel>{' '}
                    {response.statusCode} {response.statusMessage}
                </ExchangeCollapsibleSummary>

                {
                    responseDescription ?
                        <ExchangeCollapsibleBody>
                            <ExternalContent content={responseDescription!} />
                        </ExchangeCollapsibleBody>
                    : null
                }
            </CollapsibleSection>

            <ContentLabelBlock>Headers</ContentLabelBlock>
            <ContentMonoValue>
                <HeaderDetails headers={response.headers} />
            </ContentMonoValue>
        </div>
    </ExchangeCard>;
});