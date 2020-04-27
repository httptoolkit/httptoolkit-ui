import * as _ from 'lodash';
import * as React from 'react';
import { action, computed, observable } from 'mobx';
import { observer, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { HtkResponse } from '../../types';
import { styled } from '../../styles';
import { reportError } from '../../errors';

import { getStatusColor } from '../../model/http/exchange-colors';
import { HttpExchange } from '../../model/http/exchange';
import { ApiExchange } from '../../model/api/openapi';
import { UiStore } from '../../model/ui-store';
import { CollectedEvent } from '../../model/http/events-store';
import { RulesStore } from '../../model/rules/rules-store';
import { buildRuleFromRequest } from '../../model/rules/rule-definitions';

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
import { ExchangeDetailsFooter } from './exchange-details-footer';
import { ExchangeRequestBreakpointHeader, ExchangeResponseBreakpointHeader } from './exchange-breakpoint-header';
import { ExchangeBreakpointRequestCard } from './exchange-breakpoint-request-card';
import { ExchangeBreakpointResponseCard } from './exchange-breakpoint-response-card';
import { ExchangeBreakpointBodyCard } from './exchange-breakpoint-body-card';

const OuterContainer = styled.div`
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
`;

const ScrollContainer = styled.div`
    position: relative;
    overflow-y: scroll;

    flex-grow: 1;
    padding: 0 20px 0 20px;

    background-color: ${p => p.theme.containerBackground};
`;

const ContentContainer = styled.div`
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

const ExpandedContentContainer = styled.div`
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
@inject('rulesStore')
@observer
export class ExchangeDetailsPane extends React.Component<{
    exchange: HttpExchange,

    requestEditor: portals.HtmlPortalNode<typeof ThemedSelfSizedEditor>,
    responseEditor: portals.HtmlPortalNode<typeof ThemedSelfSizedEditor>,

    navigate: (path: string) => void,
    onDelete: (event: CollectedEvent) => void,
    onScrollToEvent: (event: CollectedEvent) => void,

    // Injected:
    uiStore?: UiStore,
    accountStore?: AccountStore,
    rulesStore?: RulesStore
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
        const {
            exchange,
            onDelete,
            onScrollToEvent,
            uiStore,
            accountStore,
            navigate
        } = this.props;
        const { isPaidUser } = accountStore!;
        const { expandedCard } = uiStore!;
        const { expandCompleted } = this;

        const { requestBreakpoint, responseBreakpoint } = exchange;
        const apiExchange = isPaidUser ? exchange.api : undefined;

        const headerCard = this.renderHeaderCard(exchange);

        if (expandedCard) {
            return <ExpandedContentContainer expandCompleted={expandCompleted}>
                { headerCard }
                { this.renderExpandedCard(expandedCard, exchange, apiExchange) }
            </ExpandedContentContainer>;
        }

        const cards = (requestBreakpoint || responseBreakpoint)
            ? this.renderBreakpointCards(exchange, apiExchange)
            : this.renderNormalCards(exchange, apiExchange);

        return <OuterContainer>
            <ScrollContainer>
                <ContentContainer>
                    { headerCard }
                    { cards }
                </ContentContainer>
            </ScrollContainer>
            <ExchangeDetailsFooter
                event={exchange}
                onDelete={onDelete}
                onScrollToEvent={onScrollToEvent}
                navigate={navigate}
                isPaidUser={isPaidUser}
            />
        </OuterContainer>;
    }

    renderHeaderCard(exchange: HttpExchange): JSX.Element | null {
        const { accountStore, navigate } = this.props;
        const { isPaidUser, getPro } = accountStore!;
        const {
            requestBreakpoint,
            respondToBreakpointedRequest,
            responseBreakpoint,
            tags
        } = exchange;

        if (requestBreakpoint) {
            return <ExchangeRequestBreakpointHeader
                key='breakpoint-header'
                onCreateResponse={respondToBreakpointedRequest}
                onResume={requestBreakpoint.resume}
            />;
        }

        if (responseBreakpoint) {
            return <ExchangeResponseBreakpointHeader
                key='breakpoint-header'
                onResume={responseBreakpoint.resume}
            />;
        }

        const errorHeaderProps = {
            key: 'error-header',
            isPaidUser,
            getPro,
            navigate,
            mockRequest: this.mockRequest,
            ignoreError: this.ignoreError
        };

        if (
            tags.includes("passthrough-error:SELF_SIGNED_CERT_IN_CHAIN") ||
            tags.includes("passthrough-error:DEPTH_ZERO_SELF_SIGNED_CERT") ||
            tags.includes("passthrough-error:UNABLE_TO_VERIFY_LEAF_SIGNATURE")
        ) {
            return <ExchangeErrorHeader type='untrusted' {...errorHeaderProps} />;
        }

        if (tags.includes("passthrough-error:CERT_HAS_EXPIRED")) {
            return <ExchangeErrorHeader type='expired' {...errorHeaderProps} />;
        }

        if (tags.includes("passthrough-error:ERR_TLS_CERT_ALTNAME_INVALID")) {
            return <ExchangeErrorHeader type='wrong-host' {...errorHeaderProps} />;
        }

        if (
            tags.filter(t => t.startsWith("passthrough-tls-error:")).length > 0 ||
            tags.includes("passthrough-error:EPROTO")
        ) {
            return <ExchangeErrorHeader type='tls-error' {...errorHeaderProps} />;
        }

        if (tags.includes("passthrough-error:ENOTFOUND")) {
            return <ExchangeErrorHeader type='host-not-found' {...errorHeaderProps} />;
        }

        if (tags.includes("passthrough-error:ECONNREFUSED")) {
            return <ExchangeErrorHeader type='connection-refused' {...errorHeaderProps} />;
        }

        if (tags.includes("passthrough-error:ECONNRESET")) {
            return <ExchangeErrorHeader type='connection-reset' {...errorHeaderProps} />;
        }

        if (tags.includes("passthrough-error:ETIMEDOUT")) {
            return <ExchangeErrorHeader type='timeout' {...errorHeaderProps} />;
        }

        if (tags.filter(t => t.startsWith("passthrough-error:")).length > 0) {
            reportError(`Unrecognized passthrough error tag ${JSON.stringify(tags)}`);
            return <ExchangeErrorHeader type='unknown' {...errorHeaderProps} />;
        }

        return null;
    }

    private renderExpandedCard(
        expandedCard: 'requestBody' | 'responseBody',
        exchange: HttpExchange,
        apiExchange: ApiExchange | undefined
    ) {
        if (expandedCard === 'requestBody') {
            return this.renderRequestBody(exchange, apiExchange);
        } else if (
            expandedCard === 'responseBody' && (
                exchange.isSuccessfulExchange() ||
                !!exchange.responseBreakpoint
            )) {
            return this.renderResponseBody(exchange, apiExchange);
        } else {
            reportError(`Expanded ${expandedCard}, but can't show anything`);
            return null; // Shouldn't ever happen, unless we get into a funky broken state
        }
    }

    private renderBreakpointCards(exchange: HttpExchange, apiExchange: ApiExchange | undefined) {
        const { uiStore } = this.props;
        const { requestBreakpoint } = exchange;

        const cards: JSX.Element[] = [];

        if (requestBreakpoint) {
            cards.push(<ExchangeBreakpointRequestCard
                {...this.cardProps.request}
                exchange={exchange}
                onChange={requestBreakpoint.updateMetadata}
            />);

            cards.push(this.renderRequestBody(exchange, apiExchange));
        } else {
            const responseBreakpoint = exchange.responseBreakpoint!;

            cards.push(<ExchangeRequestCard
                {...this.cardProps.request}
                exchange={exchange}
                apiExchange={apiExchange}
            />);

            if (exchange.hasRequestBody()) {
                cards.push(this.renderRequestBody(exchange, apiExchange));
            }

            cards.push(<ExchangeBreakpointResponseCard
                {...this.cardProps.response}
                exchange={exchange}
                onChange={responseBreakpoint.updateMetadata}
                theme={uiStore!.theme}
            />);

            cards.push(this.renderResponseBody(exchange, apiExchange));
        }

        return cards;
    }

    private renderNormalCards(exchange: HttpExchange, apiExchange: ApiExchange | undefined) {
        const { uiStore } = this.props;
        const { response } = exchange;

        const cards: JSX.Element[] = [];

        cards.push(<ExchangeRequestCard
            {...this.cardProps.request}
            exchange={exchange}
            apiExchange={apiExchange}
        />);

        if (exchange.hasRequestBody()) {
            cards.push(this.renderRequestBody(exchange, apiExchange));
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

            if (exchange.hasResponseBody()) {
                cards.push(this.renderResponseBody(exchange, apiExchange));
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

        return cards;
    }

    private renderRequestBody(exchange: HttpExchange, apiExchange: ApiExchange | undefined) {
        const { request, requestBreakpoint } = exchange;

        return requestBreakpoint
            ? <ExchangeBreakpointBodyCard
                {...this.requestBodyParams()}
                body={requestBreakpoint.inProgressResult.body.decoded}
                headers={requestBreakpoint.inProgressResult.headers}
                onChange={requestBreakpoint.updateBody}
            />
            : <ExchangeBodyCard
                {...this.requestBodyParams()}
                isPaidUser={this.props.accountStore!.isPaidUser}
                url={exchange.request.url}
                message={request}
                apiBodySchema={apiExchange?.request?.bodySchema}
            />;
    }

    private renderResponseBody(exchange: HttpExchange, apiExchange: ApiExchange | undefined) {
        const { response, responseBreakpoint } = exchange;

        return responseBreakpoint
            ? <ExchangeBreakpointBodyCard
                {...this.responseBodyParams()}
                body={responseBreakpoint.inProgressResult.body.decoded}
                headers={responseBreakpoint.inProgressResult.headers}
                onChange={responseBreakpoint.updateBody}
            />
            : <ExchangeBodyCard
                {...this.responseBodyParams()}
                isPaidUser={this.props.accountStore!.isPaidUser}
                url={exchange.request.url}
                message={response as HtkResponse}
                apiBodySchema={apiExchange?.response?.bodySchema}
            />;
    }

    // The common request body params, for both normal & breakpointed bodies
    private requestBodyParams() {
        return {
            ...this.cardProps.requestBody,
            title: 'Request Body',
            direction: 'right' as const,
            expanded: this.props.uiStore!.expandedCard === 'requestBody',
            editorNode: this.props.requestEditor,
            onExpandToggled: this.toggleExpand.bind(this, 'requestBody'),
        };
    }

    // The common response body params, for both normal & breakpointed bodies
    private responseBodyParams() {
        return {
            ...this.cardProps.responseBody,

            title: 'Response Body',
            direction: 'left' as const,
            expanded: this.props.uiStore!.expandedCard === 'responseBody',
            editorNode: this.props.responseEditor,
            onExpandToggled: this.toggleExpand.bind(this, 'responseBody'),
        };
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
    private mockRequest() {
        const { exchange, rulesStore, navigate } = this.props;

        const rule = buildRuleFromRequest(rulesStore!, exchange.request);
        rulesStore!.draftRules.items.unshift(rule);
        navigate(`/mock/${rule.id}`);
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