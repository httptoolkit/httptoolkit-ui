import * as _ from 'lodash';
import * as React from 'react';
import { get } from 'typesafe-get';
import { action, computed, observable } from 'mobx';
import { observer, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { HtkRequest, HtkResponse } from '../../types';
import { styled } from '../../styles';
import { getStatusColor } from '../../model/http/exchange-colors';
import { HttpExchange } from '../../model/http/exchange';
import { ApiExchange } from '../../model/api/openapi';
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
import { ExchangeErrorHeader } from './exchange-error-header';

function hasCompletedBody(res: HtkResponse | 'aborted' | undefined): res is HtkResponse {
    return !!res && res !== 'aborted' && !!res.body.encoded.byteLength;
}

const ExchangeDetailsScrollContainer = styled.div`
    position: relative;
    overflow-y: scroll;

    height: 100%;
    width: 100%;
    box-sizing: border-box;
    padding: 0 20px 0 20px;

    background-color: ${p => p.theme.containerBackground};
`;

const ExchangeDetailsContentContainer = styled.div`
    min-height: 100%;
    box-sizing: border-box;

    display: flex;
    flex-direction: column;

    /*
    * This padding could be padding on the scroll container, but doing so causes odd
    * behaviour where position: sticky headers don't take it into account, on OSX only.
    * Moving to the direct parent of the header makes that consistent, for some reason. Ew.
    */
    padding-top: 20px;
`;

const ExchangeExpandedContentContainer = styled.div`
    ${(p: { expandCompleted: boolean }) => !p.expandCompleted
        ? `padding: 20px;`
        : `
            padding: 0;
            transition: padding 0.1s;
        `
    }

    box-sizing: border-box;
    height: 100%;
    width: 100%;
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

    requestEditor: portals.HtmlPortalNode<typeof ThemedSelfSizedEditor>,
    responseEditor: portals.HtmlPortalNode<typeof ThemedSelfSizedEditor>,

    navigate: (path: string) => void

    // Injected:
    uiStore?: UiStore,
    accountStore?: AccountStore
}> {

    // Used to trigger animation on initial card expansion
    @observable private expandCompleted = true;

    @computed
    get cardProps() {
        return _.fromPairs(cardKeys.map((key) => [key, {
            key,
            expanded: key === this.props.uiStore!.expandedCard,
            collapsed: this.props.uiStore!.viewExchangeCardStates[key].collapsed &&
                !this.props.uiStore!.expandedCard,
            onCollapseToggled: this.toggleCollapse.bind(this, key)
        }]));
    }

    render() {
        const { exchange, uiStore, accountStore, navigate } = this.props;
        const { isPaidUser, getPro } = accountStore!;
        const { expandedCard } = uiStore!;
        const { expandCompleted } = this;

        const cards: JSX.Element[] = [];

        const { request, response, tags } = exchange;
        const apiExchange = isPaidUser ? exchange.api : undefined;

        if (expandedCard === 'requestBody' && request.body.encoded.byteLength) {
            return <ExchangeExpandedContentContainer expandCompleted={expandCompleted}>
                { this.renderRequestBodyCard(request, apiExchange, true) }
            </ExchangeExpandedContentContainer>;
        }

        if (expandedCard === 'responseBody' && hasCompletedBody(response)) {
            return <ExchangeExpandedContentContainer expandCompleted={expandCompleted}>
                { this.renderResponseBodyCard(response, apiExchange, true) }
            </ExchangeExpandedContentContainer>;
        }

        const errorHeaderProps = {
            key: 'error-header',
            isPaidUser,
            getPro,
            navigate,
            ignoreError: this.ignoreError
        };

        if (
            tags.includes("passthrough-error:SELF_SIGNED_CERT_IN_CHAIN") ||
            tags.includes("passthrough-error:DEPTH_ZERO_SELF_SIGNED_CERT") ||
            tags.includes("passthrough-error:UNABLE_TO_VERIFY_LEAF_SIGNATURE")
        ) {
            cards.push(<ExchangeErrorHeader type='untrusted' {...errorHeaderProps} />);
        } else if (tags.includes("passthrough-error:CERT_HAS_EXPIRED")) {
            cards.push(<ExchangeErrorHeader type='expired' {...errorHeaderProps} />);
        } else if (tags.includes("passthrough-error:ERR_TLS_CERT_ALTNAME_INVALID")) {
            cards.push(<ExchangeErrorHeader type='wrong-host' {...errorHeaderProps} />);
        } else if (
            tags.filter(t => t.startsWith("passthrough-tls-error:")).length > 0 ||
            tags.includes("passthrough-error:EPROTO")
        ) {
            cards.push(<ExchangeErrorHeader type='tls-error' {...errorHeaderProps} />);
        } else if (tags.includes("passthrough-error:ENOTFOUND")) {
            cards.push(<ExchangeErrorHeader type='host-not-found' {...errorHeaderProps} />);
        }

        cards.push(<ExchangeRequestCard
            {...this.cardProps.request}
            exchange={exchange}
            apiExchange={apiExchange}
        />);

        if (request.body.encoded.byteLength) {
            cards.push(this.renderRequestBodyCard(request, apiExchange, false));
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
                cards.push(this.renderResponseBodyCard(response, apiExchange, false));
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

    private renderRequestBodyCard(request: HtkRequest, api: ApiExchange | undefined, expanded: boolean) {
        return <ExchangeBodyCard
            title='Request Body'
            direction='right'
            expanded={expanded}
            message={request}
            editorNode={this.props.requestEditor}
            apiBodySchema={get(api, 'request', 'bodySchema')}
            onExpandToggled={this.toggleExpand.bind(this, 'requestBody')}

            {...this.cardProps.requestBody}
        />
    }

    private renderResponseBodyCard(response: HtkResponse, api: ApiExchange | undefined, expanded: boolean) {
        return <ExchangeBodyCard
            title='Response Body'
            direction='left'
            expanded={expanded}
            message={response}
            editorNode={this.props.responseEditor}
            apiBodySchema={get(api, 'response', 'bodySchema')}
            onExpandToggled={this.toggleExpand.bind(this, 'responseBody')}
            {...this.cardProps.responseBody}
        />
    }

    @action.bound
    private toggleCollapse(key: CardKey) {
        const { viewExchangeCardStates } = this.props.uiStore!;

        const cardState = viewExchangeCardStates[key];
        cardState.collapsed = !cardState.collapsed;

        this.props.uiStore!.expandedCard = undefined;
    }


    @action.bound
    private toggleExpand(key: CardKey) {
        const uiStore = this.props.uiStore!;

        if (uiStore.expandedCard === key) {
            uiStore.expandedCard = undefined;
        } else if (key === 'requestBody' || key === 'responseBody') {
            uiStore.viewExchangeCardStates[key].collapsed = false;
            uiStore.expandedCard = key;

            this.expandCompleted = false;
            requestAnimationFrame(action(() => {
                this.expandCompleted = true;
            }));
        }
    }

    @action.bound
    private ignoreError() {
        const { exchange } = this.props;

        // Drop all error tags from this exchange
        exchange.tags = exchange.tags.filter(t =>
            !t.startsWith('passthrough-error:') &&
            !t.startsWith('passthrough-tls-error:')
        );
    }

};