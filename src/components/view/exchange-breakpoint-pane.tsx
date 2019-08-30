import * as _ from 'lodash';
import * as React from 'react';
import { action, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { MockttpBreakpointRequestResult } from '../../types';
import { styled } from '../../styles';
import { HttpExchange } from '../../model/exchange';
import { UiStore } from '../../model/ui-store';

import { ExchangeBodyCard } from './exchange-body-card';
import { ExchangeRequestCard } from './exchange-request-card';
import { ExchangeRequestBreakpointCard } from './exchange-request-breakpoint-card';

const ExchangeBreakpointScrollContainer = styled.div`
    position: relative;
    overflow-y: scroll;

    height: 100%;
    width: 100%;
    box-sizing: border-box;
    padding: 20px 20px 0 20px;

    background-color: ${p => p.theme.containerBackground};
`;

const ExchangeBreakpointContentContainer = styled.div`
    min-height: 100%;

    display: flex;
    flex-direction: column;
`;

const cardKeys = [
    'request',
    'requestBody',
    'response',
    'responseBody'
] as const;

type CardKey = typeof cardKeys[number];

@inject('uiStore')
@observer
export class ExchangeBreakpointPane extends React.Component<{
    exchange: HttpExchange,
    // Injected:
    uiStore?: UiStore,
    requestEditor: portals.PortalNode,
    responseEditor: portals.PortalNode
}> {

    @computed
    get cardProps() {
        return _.fromPairs(cardKeys.map((key) => [key, {
            key,
            collapsed: this.props.uiStore!.viewExchangeCardStates[key].collapsed,
            onCollapseToggled: this.toggleCollapse.bind(this, key)
        }]));
    }

    @action.bound
    updateRequestResult(result: MockttpBreakpointRequestResult) {
        this.props.exchange.requestBreakpoint!.inProgressResult = result;
    }

    render() {
        const { exchange } = this.props;

        const cards: JSX.Element[] = [];

        const {
            isRequestBreakpointed,
            request
        } = exchange;

        if (isRequestBreakpointed) {
            cards.push(<ExchangeRequestBreakpointCard
                {...this.cardProps.request}
                key={`request-${exchange.id}`}
                exchange={exchange}
                onChange={this.updateRequestResult}
            />);
        } else {
            cards.push(<ExchangeRequestCard
                {...this.cardProps.request}
                exchange={exchange}
            />);

            if (request.body.encoded.byteLength) {
                cards.push(<ExchangeBodyCard
                    title='Request Body'
                    direction='right'
                    message={request}
                    editorNode={this.props.requestEditor}
                    {...this.cardProps.requestBody}
                />);
            }

            cards.push(<div>[breakpointed response]</div>);
        }

        return <ExchangeBreakpointScrollContainer>
            <ExchangeBreakpointContentContainer>
                {cards}
            </ExchangeBreakpointContentContainer>
        </ExchangeBreakpointScrollContainer>;
    }

    @action.bound
    private toggleCollapse(key: CardKey) {
        const { viewExchangeCardStates } = this.props.uiStore!;
        const cardState = viewExchangeCardStates[key];
        cardState.collapsed = !cardState.collapsed;
    }

};