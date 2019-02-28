import * as React from 'react';
import { observer } from 'mobx-react';
import { get } from 'typesafe-get';

import { HtkResponse, Omit } from '../../types';
import { Theme } from '../../styles';

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
    isPaidUser: boolean;
    theme: Theme;
    response: HtkResponse;
    apiExchange: ApiExchange | undefined;
}

const RawResponseDetails = (p: { response: HtkResponse }) => <div>
    <ContentLabel>Status:</ContentLabel>
    <ContentMonoValue>
        {p.response.statusCode} {p.response.statusMessage}
    </ContentMonoValue>

    <ContentLabelBlock>Headers</ContentLabelBlock>
    <ContentMonoValue>
        <HeaderDetails headers={p.response.headers} />
    </ContentMonoValue>
</div>

const SmartResponseDetails = (p: {
    response: HtkResponse,
    apiExchange: ApiExchange | undefined
}) => {
    const responseDescription = get(
        p.apiExchange, 'response', 'description'
    );

    return <div>
        <CollapsibleSection prefix={false}>
            <ExchangeCollapsibleSummary>
                <ContentLabel>Status:</ContentLabel>{' '}
                    {p.response.statusCode} {p.response.statusMessage}
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
            <HeaderDetails headers={p.response.headers} />
        </ContentMonoValue>
    </div>
};

export const ExchangeResponseCard = observer((props: ExchangeResponseCardProps) => {
    const { response, theme, isPaidUser, apiExchange } = props;

    return <ExchangeCard {...props} direction='left'>
        <header>
            <Pill color={getStatusColor(response.statusCode, theme!)}>{
                response.statusCode
            }</Pill>
            <h1>Response</h1>
        </header>
        { isPaidUser ?
            <SmartResponseDetails response={response} apiExchange={apiExchange} /> :
            <RawResponseDetails response={response} />
        }
    </ExchangeCard>;
});