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

type CardKey = 'request' | 'requestBody' | 'response' | 'responseBody';

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
        'responseBody': {}
    }, (_value, key) => ({
        key: key,
        collapsed: false,
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
        const cardProps = this.cardProps[key];
        cardProps.collapsed = !cardProps.collapsed;
    }

};