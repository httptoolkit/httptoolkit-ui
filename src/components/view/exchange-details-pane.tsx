import * as _ from 'lodash';
import * as React from 'react';
import { get } from 'typesafe-get';
import { action, observable } from 'mobx';
import { observer, inject } from 'mobx-react';

import { HtkResponse } from '../../types';
import { styled, Theme } from '../../styles';
import { reportError } from '../../errors';
import { getStatusColor } from '../../exchange-colors';
import { HttpExchange } from '../../model/exchange';

import { getMatchingAPI, parseExchange } from '../../model/openapi/openapi';

import { Pill } from '../common/pill';
import { EmptyState } from '../common/empty-state';
import { ExchangeCard } from './exchange-card';
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
    private collapseState = {
        'request': false,
        'requestBody': false,
        'response': false,
        'responseBody': false
    };

    private cardProps = (key: CardKey) => ({
        key: key,
        collapsed: this.collapseState[key],
        onCollapseToggled: this.toggleCollapse.bind(this, key)
    });

    render() {
        const { exchange, theme, accountStore: account } = this.props;
        const cards: JSX.Element[] = [];

        if (exchange) {
            const { request, response } = exchange;

            const knownApi = getMatchingAPI(exchange);
            const apiExchange = knownApi && knownApi
                .then(api => parseExchange(api, exchange))
                .catch((e) => {
                    reportError(e);
                    throw e;
                });

            cards.push(<ExchangeRequestCard
                {...this.cardProps('request')}
                exchange={exchange}
                apiExchange={apiExchange}
                isPaidUser={account!.isPaidUser}
            />);

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
                cards.push(<ExchangeResponseCard
                    {...this.cardProps('response')}
                    response={response}
                    apiExchange={apiExchange}
                    theme={theme!}
                />);

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