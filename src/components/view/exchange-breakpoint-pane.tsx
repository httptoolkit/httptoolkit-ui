import * as _ from 'lodash';
import * as React from 'react';
import { action, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { styled } from '../../styles';
import { HttpExchange } from '../../model/exchange';
import { UiStore } from '../../model/ui-store';

import { ExchangeBodyCard } from './exchange-body-card';
import { ExchangeRequestCard } from './exchange-request-card';
import { ExchangeRequestBreakpointHeader, ExchangeResponseBreakpointHeader } from './exchange-breakpoint-header';
import { ExchangeBreakpointRequestCard } from './exchange-breakpoint-request-card';
import { ExchangeBreakpointResponseCard } from './exchange-breakpoint-response-card';
import { ExchangeBreakpointBodyCard } from './exchange-breakpoint-body-card';
import { ThemedSelfSizedEditor } from '../editor/base-editor';

const ExchangeBreakpointScrollContainer = styled.div`
    position: relative;
    overflow-y: scroll;

    height: 100%;
    width: 100%;
    box-sizing: border-box;
    padding: 0 20px 0 20px;

    background-color: ${p => p.theme.containerBackground};
`;

const ExchangeBreakpointContentContainer = styled.div`
    min-height: 100%;

    display: flex;
    flex-direction: column;

    /*
     * This margin could be padding on the scroll container, but doing so causes odd
     * behaviour where position: sticky headers don't take it into account, on OSX only.
     * Moving to the direct parent of the header makes that consistent, for some reason. Ew.
    */
    margin-top: 20px;
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

    editorNode: portals.PortalNode<typeof ThemedSelfSizedEditor>

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
    toggleCollapse(key: CardKey) {
        const { viewExchangeCardStates } = this.props.uiStore!;
        const cardState = viewExchangeCardStates[key];
        cardState.collapsed = !cardState.collapsed;
    }

    render() {
        const { exchange, uiStore } = this.props;

        const cards: JSX.Element[] = [];

        const { requestBreakpoint } = exchange;

        if (requestBreakpoint) {
            cards.push(
                <ExchangeRequestBreakpointHeader
                    key='breakpoint-header'
                    onCreateResponse={exchange.respondToBreakpointedRequest}
                    onResume={requestBreakpoint.resume}
                />
            );

            cards.push(<ExchangeBreakpointRequestCard
                {...this.cardProps.request}
                exchange={exchange}
                onChange={requestBreakpoint.updateResult}
            />);

            cards.push(<ExchangeBreakpointBodyCard
                title='Request Body'
                direction='right'
                body={requestBreakpoint.inProgressResult.body}
                headers={requestBreakpoint.inProgressResult.headers}
                onChange={requestBreakpoint.updateBody}
                editorNode={this.props.editorNode}
                {...this.cardProps.requestBody}
            />);
        } else {
            const { request } = exchange;
            const responseBreakpoint = exchange.responseBreakpoint!;

            cards.push(
                <ExchangeResponseBreakpointHeader
                    key='breakpoint-header'
                    onResume={responseBreakpoint.resume}
                />
            );

            cards.push(<ExchangeRequestCard
                {...this.cardProps.request}
                exchange={exchange}
            />);

            if (request.body.encoded.byteLength) {
                cards.push(<ExchangeBodyCard
                    title='Request Body'
                    direction='right'
                    message={request}
                    editorNode={this.props.editorNode}
                    {...this.cardProps.requestBody}
                />);
            }

            cards.push(<ExchangeBreakpointResponseCard
                {...this.cardProps.response}
                exchange={exchange}
                onChange={responseBreakpoint.updateResult}
                theme={uiStore!.theme}
            />);

            cards.push(<ExchangeBreakpointBodyCard
                title='Response Body'
                direction='left'
                body={responseBreakpoint.inProgressResult.body}
                headers={responseBreakpoint.inProgressResult.headers}
                onChange={responseBreakpoint.updateBody}
                editorNode={this.props.editorNode}
                {...this.cardProps.responseBody}
            />);
        }

        return <ExchangeBreakpointScrollContainer>
            <ExchangeBreakpointContentContainer>
                {cards}
            </ExchangeBreakpointContentContainer>
        </ExchangeBreakpointScrollContainer>;
    }

};