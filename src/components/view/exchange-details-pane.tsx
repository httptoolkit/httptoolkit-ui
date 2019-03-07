import * as _ from 'lodash';
import * as React from 'react';
import { get } from 'typesafe-get';
import { action, observable } from 'mobx';
import { observer, inject } from 'mobx-react';

import { HtkResponse, Omit } from '../../types';
import { styled, Theme } from '../../styles';
import { getStatusColor } from '../../exchange-colors';
import { HttpExchange } from '../../model/exchange';

import { Pill } from '../common/pill';
import { EmptyState } from '../common/empty-state';
import { ExchangeCard, ExchangeCardProps } from './exchange-card';
import { ExchangeBodyCard } from './exchange-body-card';
import { ExchangeRequestCard } from './exchange-request-card';
import { ExchangeResponseCard } from './exchange-response-card';
import { AccountStore } from '../../model/account/account-store';
import { ExchangePerformanceCard } from './exchange-performance-card';

function hasCompletedBody(res: HtkResponse | 'aborted' | undefined): res is HtkResponse {
    return !!get(res as any, 'body', 'buffer');
}

const ExchangeDetailsScrollContainer = styled.div`
    position: relative;
    overflow-y: scroll;

    height: 100%;
    width: 100%;
    box-sizing: border-box;
    padding: 20px 20px 0 20px;

    background-color: ${p => p.theme.containerBackground};
`;

const ExchangeDetailsContentContainer = styled.div`
    min-height: 100%;

    display: flex;
    flex-direction: column;
`;

// Used to push all cards below it to the bottom (when less than 100% height)
const CardDivider = styled.div`
    margin-top: auto;
`;

type CardKey = 'request' | 'requestBody' | 'response' | 'responseBody' | 'performance';

@inject('theme')
@inject('accountStore')
@observer
export class ExchangeDetailsPane extends React.Component<{
    exchange: HttpExchange | undefined,
    // Injected:
    theme?: Theme,
    accountStore?: AccountStore
}> {

    @observable
    private cardProps = _.mapValues<{}, Omit<ExchangeCardProps, 'children'>>({
        'request': {},
        'requestBody': {},
        'response': {},
        'responseBody': {},

        'performance': { collapsed: true }
    }, (_value: { collapsed?: boolean }, key) => ({
        key: key,
        collapsed: _value.collapsed || false,
        onCollapseToggled: this.toggleCollapse.bind(this, key)
    }));

    render() {
        const { exchange, theme, accountStore } = this.props;
        const { isPaidUser } = accountStore!;

        const cards: JSX.Element[] = [];

        if (exchange) {
            const { request, response } = exchange;
            const apiExchange = isPaidUser ? exchange.api : undefined;

            cards.push(<ExchangeRequestCard
                {...this.cardProps.request}
                exchange={exchange}
                apiExchange={apiExchange}
            />);

            if (request.body.buffer) {
                cards.push(<ExchangeBodyCard
                    title='Request Body'
                    direction='right'
                    message={request}
                    apiBodySchema={get(apiExchange, 'request', 'bodySchema')}
                    {...this.cardProps.requestBody}
                />);
            }

            if (response === 'aborted') {
                cards.push(<ExchangeCard {...this.cardProps.response} direction='left'>
                    <header>
                    <Pill color={getStatusColor(response, theme!)}>Aborted</Pill>
                        <h1>Response</h1>
                    </header>
                    <div>
                        The request was aborted before the response was completed.
                    </div>
                </ExchangeCard>);
            } else if (!!response) {
                cards.push(<ExchangeResponseCard
                    {...this.cardProps.response}
                    response={response}
                    requestUrl={exchange.request.parsedUrl}
                    apiExchange={apiExchange}
                    theme={theme!}
                />);

                if (hasCompletedBody(response)) {
                    cards.push(<ExchangeBodyCard
                        title='Response Body'
                        direction='left'
                        message={response}
                        apiBodySchema={get(apiExchange, 'response', 'bodySchema')}
                        {...this.cardProps.responseBody}
                    />);
                }
            }

            // Push all cards below this point to the bottom
            cards.push(<CardDivider key='divider' />);

            cards.push(<ExchangePerformanceCard
                exchange={exchange}
                {...this.cardProps.performance}
            />);
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

        return <ExchangeDetailsScrollContainer>
            <ExchangeDetailsContentContainer>
                {cards}
            </ExchangeDetailsContentContainer>
        </ExchangeDetailsScrollContainer>;
    }

    @action.bound
    private toggleCollapse(key: CardKey) {
        const cardProps = this.cardProps[key];
        cardProps.collapsed = !cardProps.collapsed;
    }

};