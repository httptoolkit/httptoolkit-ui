import * as _ from 'lodash';
import * as React from 'react';
import { get } from 'typesafe-get';
import { observer } from 'mobx-react';

import { HttpExchange, HtkResponse } from '../../types';
import { styled } from '../../styles';
import { getExchangeSummaryColour, getStatusColor } from '../../exchange-colors';

import { Pill } from '../common/pill';
import { EmptyState } from '../common/empty-state';
import { HeaderDetails } from './header-details';
import { ExchangeCard } from './exchange-card';
import { ExchangeBodyCard } from './exchange-body-card';

function hasCompletedBody(res: HtkResponse | 'aborted' | undefined): res is HtkResponse {
    return !!get(res as any, 'body', 'buffer');
}

const ExchangeDetailsContainer = styled.div`
    position: relative;
    overflow-y: auto;

    height: 100%;
    width: 100%;
    box-sizing: border-box;

    background-color: ${p => p.theme.containerBackground};
`;

const ContentLabel = styled.div`
    text-transform: uppercase;
    opacity: 0.5;

    margin-bottom: 10px;
    width: 100%;

    &:not(:first-child) {
        margin-top: 10px;
    }
`;

const ContentValue = styled.div`
    font-family: 'Fira Mono', monospace;
    width: 100%;
`;

@observer
export class ExchangeDetailsPane extends React.Component<{ exchange: HttpExchange | undefined }> {

    render() {
        const { exchange } = this.props;
        const cards: JSX.Element[] = [];

        if (exchange) {
            const { request, response } = exchange;

            cards.push(<ExchangeCard tabIndex={0} key='request' direction='right'>
                <header>
                    <Pill color={getExchangeSummaryColour(exchange)}>
                        { request.method } {
                            request.hostname
                            // Add some tiny spaces to split up parts of the hostname
                            .replace(/\./g, '\u2008.\u2008')
                        }
                    </Pill>
                    <h1>Request</h1>
                </header>
                <div>
                    <ContentLabel>URL</ContentLabel>
                    <ContentValue>{
                        new URL(request.url, `${request.protocol}://${request.hostname}`).toString()
                    }</ContentValue>

                    <ContentLabel>Headers</ContentLabel>
                    <ContentValue>
                        <HeaderDetails headers={request.headers} />
                    </ContentValue>
                </div>
            </ExchangeCard>);

            if (request.body.buffer) {
                cards.push(<ExchangeBodyCard
                    key='requestBody'
                    direction='right'
                    message={request}
                />);
            }

            if (response === 'aborted') {
                cards.push(<ExchangeCard tabIndex={0} key='response' direction='left'>
                    <header>
                    <Pill color={getStatusColor(response)}>Aborted</Pill>
                        <h1>Response</h1>
                    </header>
                    <div>
                        The request was aborted before the response was completed.
                    </div>
                </ExchangeCard>);
            } else if (!!response) {
                cards.push(<ExchangeCard tabIndex={0} key='response' direction='left'>
                    <header>
                        <Pill color={getStatusColor(response.statusCode)}>{ response.statusCode }</Pill>
                        <h1>Response</h1>
                    </header>
                    <div>
                        <ContentLabel>Status</ContentLabel>
                        <ContentValue>
                            {response.statusCode}: {response.statusMessage}
                        </ContentValue>

                        <ContentLabel>Headers</ContentLabel>
                        <ContentValue>
                            <HeaderDetails headers={response.headers} />
                        </ContentValue>
                    </div>
                </ExchangeCard>);

                if (hasCompletedBody(response)) {
                    cards.push(<ExchangeBodyCard
                        key='responseBody'
                        direction='left'
                        message={response}
                    />);
                }
            }
        } else {
            cards.push(
                <EmptyState
                    key='empty'
                    tabIndex={0}
                    icon={['far', 'arrow-left']}
                    message='Select some requests to see their details.'
                />
            );
        }

        return <ExchangeDetailsContainer>
            {cards}
        </ExchangeDetailsContainer>;
    }

};