import * as _ from 'lodash';
import * as React from 'react';
import { get } from 'typesafe-get';
import { action, observable } from 'mobx';
import { observer, inject } from 'mobx-react';

import { HttpExchange, HtkResponse } from '../../types';
import { styled, Theme } from '../../styles';
import { FontAwesomeIcon, Icons } from '../../icons';
import { getExchangeSummaryColour, getStatusColor } from '../../exchange-colors';

import { TrafficSource } from '../../model/sources';
import { getMatchingAPI, parseExchange } from '../../model/openapi';

import { Pill } from '../common/pill';
import { EmptyState } from '../common/empty-state';
import { HeaderDetails } from './header-details';
import { ExchangeCard, ContentLabel, ContentMonoValue } from './exchange-card';
import { ExchangeBodyCard } from './exchange-body-card';
import { ExchangeApiCard } from './exchange-api-card';

function hasCompletedBody(res: HtkResponse | 'aborted' | undefined): res is HtkResponse {
    return !!get(res as any, 'body', 'buffer');
}

const ExchangeDetailsContainer = styled.div`
    position: relative;
    overflow-y: auto;

    height: 100%;
    width: 100%;
    box-sizing: border-box;
    padding: 20px 20px 0 20px;

    background-color: ${p => p.theme.containerBackground};
`;

const SourceIcon = styled(({ source, className }: { source: TrafficSource, className?: string }) =>
    source.icon !== Icons.Unknown ?
        <FontAwesomeIcon
            className={className}
            title={source.description}
            {...source.icon}
        /> : null
)`
    margin-right: 8px;
`;

type CardKey = 'request' | 'requestBody' | 'response' | 'responseBody' | 'knownApi';

@inject('theme')
@observer
export class ExchangeDetailsPane extends React.Component<{
    exchange: HttpExchange | undefined,
    theme?: Theme
}> {

    @observable
    private collapseState = {
        'request': false,
        'requestBody': false,
        'response': false,
        'responseBody': false,
        'knownApi': false
    };

    private cardProps = (key: CardKey) => ({
        key: key,
        collapsed: this.collapseState[key],
        onCollapseToggled: this.toggleCollapse.bind(this, key)
    });

    render() {
        const { exchange, theme } = this.props;
        const cards: JSX.Element[] = [];

        if (exchange) {
            const { request, response } = exchange;

            const knownApi = getMatchingAPI(exchange);
            const apiExchange = knownApi && knownApi.then(api => parseExchange(api, exchange));
            if (apiExchange) {
                cards.push(<ExchangeApiCard
                    {...this.cardProps('knownApi')}
                    apiExchange={apiExchange}
                />);
            }

            cards.push(<ExchangeCard {...this.cardProps('request')} direction='right'>
                <header>
                    <SourceIcon source={request.source} />
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
                    <ContentMonoValue>{
                        request.parsedUrl.toString()
                    }</ContentMonoValue>

                    <ContentLabel>Headers</ContentLabel>
                    <ContentMonoValue>
                        <HeaderDetails headers={request.headers} />
                    </ContentMonoValue>
                </div>
            </ExchangeCard>);

            if (request.body.buffer) {
                cards.push(<ExchangeBodyCard
                    title='Request Body'
                    direction='right'
                    message={request}
                    apiBody={apiExchange && apiExchange.then(ex => ex.requestBody)}
                    {...this.cardProps('requestBody')}
                />);
            }

            if (response === 'aborted') {
                cards.push(<ExchangeCard {...this.cardProps('response')} direction='left'>
                    <header>
                    <Pill color={getStatusColor(response, theme!)}>Aborted</Pill>
                        <h1>Response</h1>
                    </header>
                    <div>
                        The request was aborted before the response was completed.
                    </div>
                </ExchangeCard>);
            } else if (!!response) {
                cards.push(<ExchangeCard {...this.cardProps('response')} direction='left'>
                    <header>
                        <Pill color={getStatusColor(response.statusCode, theme!)}>{ response.statusCode }</Pill>
                        <h1>Response</h1>
                    </header>
                    <div>
                        <ContentLabel>Status</ContentLabel>
                        <ContentMonoValue>
                            {response.statusCode}: {response.statusMessage}
                        </ContentMonoValue>

                        <ContentLabel>Headers</ContentLabel>
                        <ContentMonoValue>
                            <HeaderDetails headers={response.headers} />
                        </ContentMonoValue>
                    </div>
                </ExchangeCard>);

                if (hasCompletedBody(response)) {
                    cards.push(<ExchangeBodyCard
                        title='Response Body'
                        direction='left'
                        message={response}
                        apiBody={apiExchange && apiExchange.then(ex => ex.responseBody)}
                        {...this.cardProps('responseBody')}
                    />);
                }
            }
        } else {
            cards.push(
                <EmptyState
                    key='empty'
                    tabIndex={0}
                    icon={['fas', 'arrow-left']}
                    message='Select an exchange to see the full details.'
                />
            );
        }

        return <ExchangeDetailsContainer>
            {cards}
        </ExchangeDetailsContainer>;
    }

    @action.bound
    private toggleCollapse(key: CardKey) {
        this.collapseState[key] = !this.collapseState[key];
    }

};