import * as _ from 'lodash';
import * as React from 'react';
import { get } from 'typesafe-get';
import { action, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { HtkResponse } from '../../types';
import { styled } from '../../styles';
import { getStatusColor } from '../../model/exchange-colors';
import { HttpExchange } from '../../model/exchange';
import { UiStore } from '../../model/ui-store';

import { Pill } from '../common/pill';
import { CollapsibleCardHeading } from '../common/card';
import { ExchangeCard } from './exchange-card';
import { ExchangeBodyCard } from './exchange-body-card';
import { ExchangeRequestCard } from './exchange-request-card';
import { ExchangeResponseCard } from './exchange-response-card';
import { AccountStore } from '../../model/account/account-store';
import { ExchangePerformanceCard } from './exchange-performance-card';
import { ExchangeExportCard } from './exchange-export-card';
import { ThemedSelfSizedEditor } from '../editor/base-editor';

function hasCompletedBody(res: HtkResponse | 'aborted' | undefined): res is HtkResponse {
    return !!res && res !== 'aborted' && !!res.body.encoded.byteLength;
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

const cardKeys = [
    'request',
    'requestBody',
    'response',
    'responseBody',
    'performance',
    'export'
] as const;

type CardKey = typeof cardKeys[number];

@inject('uiStore')
@inject('accountStore')
@observer
export class ExchangeDetailsPane extends React.Component<{
    exchange: HttpExchange,

    requestEditor: portals.PortalNode<typeof ThemedSelfSizedEditor>,
    responseEditor: portals.PortalNode<typeof ThemedSelfSizedEditor>,

    // Injected:
    uiStore?: UiStore,
    accountStore?: AccountStore
}> {

    @computed
    get cardProps() {
        return _.fromPairs(cardKeys.map((key) => [key, {
            key,
            collapsed: this.props.uiStore!.viewExchangeCardStates[key].collapsed,
            onCollapseToggled: this.toggleCollapse.bind(this, key)
        }]));
    }

    render() {
        const { exchange, uiStore, accountStore } = this.props;
        const { isPaidUser } = accountStore!;

        const cards: JSX.Element[] = [];

        const { request, response } = exchange;
        const apiExchange = isPaidUser ? exchange.api : undefined;

        cards.push(<ExchangeRequestCard
            {...this.cardProps.request}
            exchange={exchange}
            apiExchange={apiExchange}
        />);

        if (request.body.encoded.byteLength) {
            cards.push(<ExchangeBodyCard
                title='Request Body'
                direction='right'
                message={request}
                editorNode={this.props.requestEditor}
                apiBodySchema={get(apiExchange, 'request', 'bodySchema')}
                {...this.cardProps.requestBody}
            />);
        }

        if (response === 'aborted') {
            cards.push(<ExchangeCard {...this.cardProps.response} direction='left'>
                <header>
                    <Pill color={getStatusColor(response, uiStore!.theme)}>Aborted</Pill>
                    <CollapsibleCardHeading onCollapseToggled={this.cardProps.response.onCollapseToggled}>
                        Response
                    </CollapsibleCardHeading>
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
                theme={uiStore!.theme}
            />);

            if (hasCompletedBody(response)) {
                cards.push(<ExchangeBodyCard
                    title='Response Body'
                    direction='left'
                    message={response}
                    editorNode={this.props.responseEditor}
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

        cards.push(<ExchangeExportCard
            exchange={exchange}
            {...this.cardProps.export}
        />);

        return <ExchangeDetailsScrollContainer>
            <ExchangeDetailsContentContainer>
                {cards}
            </ExchangeDetailsContentContainer>
        </ExchangeDetailsScrollContainer>;
    }

    @action.bound
    private toggleCollapse(key: CardKey) {
        const { viewExchangeCardStates } = this.props.uiStore!;
        const cardState = viewExchangeCardStates[key];
        cardState.collapsed = !cardState.collapsed;
    }

};