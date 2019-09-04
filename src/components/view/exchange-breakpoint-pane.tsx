import * as _ from 'lodash';
import * as React from 'react';
import { action, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { BreakpointRequestResult } from '../../types';
import { styled } from '../../styles';
import { HttpExchange } from '../../model/exchange';
import { UiStore } from '../../model/ui-store';

import { ExchangeBodyCard } from './exchange-body-card';
import { ExchangeRequestCard } from './exchange-request-card';
import { ExchangeBreakpointHeader } from './exchange-breakpoint-header';
import { ExchangeBreakpointRequestCard } from './exchange-breakpoint-request-card';
import { ExchangeBreakpointBodyCard } from './exchange-breakpoint-body-card';

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

    requestEditor: portals.PortalNode,
    responseEditor: portals.PortalNode

    // Injected:
    uiStore?: UiStore
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
    updateRequestResult(result: BreakpointRequestResult) {
        this.props.exchange.requestBreakpoint!.inProgressResult = result;
    }

    @action.bound
    updateRequestBody(body: string) {
        const requestBreakpoint = this.props.exchange.requestBreakpoint!;
        requestBreakpoint!.inProgressResult = Object.assign({},
            requestBreakpoint.inProgressResult,
            { body: Buffer.from(body) }
        );
    }

    @action.bound
    private resumeRequest() {
        this.props.exchange.resumeRequestFromBreakpoint();
    }

    @action.bound
    private toggleCollapse(key: CardKey) {
        const { viewExchangeCardStates } = this.props.uiStore!;
        const cardState = viewExchangeCardStates[key];
        cardState.collapsed = !cardState.collapsed;
    }

    render() {
        const { exchange } = this.props;

        const cards: JSX.Element[] = [];

        const {
            requestBreakpoint,
        } = exchange;

        if (requestBreakpoint) {
            cards.push(
                <ExchangeBreakpointHeader
                    key='breakpoint-header'
                    type='request'
                    onResume={this.resumeRequest}
                />
            );

            cards.push(<ExchangeBreakpointRequestCard
                {...this.cardProps.request}
                key={`request-${exchange.id}`}
                exchange={exchange}
                onChange={this.updateRequestResult}
            />);

            cards.push(<ExchangeBreakpointBodyCard
                title='Request Body'
                direction='right'
                body={requestBreakpoint.inProgressResult.body}
                headers={requestBreakpoint.inProgressResult.headers}
                onChange={this.updateRequestBody}
                {...this.cardProps.requestBody}
            />);
        } else {
            const { request } = exchange;

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

};