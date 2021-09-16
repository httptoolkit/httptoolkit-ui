import * as _ from 'lodash';
import * as React from 'react';
import { action, computed, observable } from 'mobx';
import { observer, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { CollectedEvent, HtkResponse, HttpExchange } from '../../types';
import { styled } from '../../styles';
import { reportError } from '../../errors';

import { getStatusColor } from '../../model/http/exchange-colors';
import { ApiExchange } from '../../model/api/openapi';
import { UiStore } from '../../model/ui-store';
import { RulesStore } from '../../model/rules/rules-store';
import { buildRuleFromRequest } from '../../model/rules/rule-definitions';

import { Pill } from '../common/pill';
import { CollapsibleCardHeading } from '../common/card';
import { ExchangeCard } from './exchange-card';
import { ExchangeBodyCard } from './exchange-body-card';
import { ExchangeApiCard, ExchangeApiPlaceholderCard } from './exchange-api-card';
import { ExchangeRequestCard } from './exchange-request-card';
import { ExchangeResponseCard } from './exchange-response-card';
import { AccountStore } from '../../model/account/account-store';
import { ExchangePerformanceCard } from './exchange-performance-card';
import { ExchangeExportCard } from './exchange-export-card';
import { ThemedSelfSizedEditor } from '../editor/base-editor';
import { ExchangeErrorHeader, tagsToErrorType } from './exchange-error-header';
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

    display: flex;
    flex-direction: column;
`;

// Used to push all cards below it to the bottom (when less than 100% height)
const CardDivider = styled.div`
    margin-top: auto;
`;

const makeFriendlyApiName = (rawName: string) => {
    // Some API names are camelCase: make *only* those more readable
    const cleanedName = !rawName.includes(' ') && rawName.length > 6
        ? _.startCase(rawName)
        : rawName;

    // Trim down any REALLY long names ("U.S. EPA Enforcement and ...")
    return cleanedName.length > 75
        ? cleanedName.slice(0, 72).trimRight() + '\u2026' // ...
        : cleanedName;
}

const cardKeys = [
    'api',
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

        // The full API details - only available for paid usage, so we drop this
        // for non-paid users at this stage.
        const apiExchange = isPaidUser ? exchange.api : undefined;

        // We do still want the API name though, if there is one - we use this to
        // show non-paid users when API data might be available, iff this request
        // does actually match a documented operation.
        const apiName = exchange.api?.matchedOperation()
            ? makeFriendlyApiName(exchange.api.service.name)
            : undefined;

        const headerCard = this.renderHeaderCard(exchange);

        if (expandedCard) {
            return <ExpandedContentContainer expandCompleted={expandCompleted}>
                { headerCard }
                { this.renderExpandedCard(expandedCard, exchange, apiExchange) }
            </ExpandedContentContainer>;
        }

        const cards = (requestBreakpoint || responseBreakpoint)
            ? this.renderBreakpointCards(exchange, apiName, apiExchange)
            : this.renderNormalCards(exchange, apiName, apiExchange);

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
                onClose={requestBreakpoint.close}
            />;
        }

        if (responseBreakpoint) {
            return <ExchangeResponseBreakpointHeader
                key='breakpoint-header'
                onResume={responseBreakpoint.resume}
                onClose={responseBreakpoint.close}
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

        const errorType = tagsToErrorType(tags);

        if (errorType) {
            return <ExchangeErrorHeader type={errorType} {...errorHeaderProps} />;
        } else {
            return null;
        }
    }

    private renderApiCard(
        apiName: string | undefined,
        apiExchange: ApiExchange | undefined
    ) {
        if (!apiName) return null;

        if (!this.props.accountStore!.isPaidUser) {
            // If you're not paid, but we do recognize this as a specific API
            // operation, we show a placeholder:
            return <ExchangeApiPlaceholderCard
                {...this.cardProps.api}
                apiName={apiName}
            />;
        }

        // If paid & we have a name, we must have full API details, show them:
        return <ExchangeApiCard
            {...this.cardProps.api}
            apiName={apiName}
            apiExchange={apiExchange!}
        />;
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

    private renderBreakpointCards(
        exchange: HttpExchange,
        apiName: string | undefined,
        apiExchange: ApiExchange | undefined
    ) {
        const { uiStore } = this.props;
        const { requestBreakpoint } = exchange;

        const cards: Array<JSX.Element | null> = [];

        if (requestBreakpoint) {
            cards.push(<ExchangeBreakpointRequestCard
                {...this.cardProps.request}
                exchange={exchange}
                onChange={requestBreakpoint.updateMetadata}
            />);

            cards.push(this.renderRequestBody(exchange, apiExchange));
        } else {
            const responseBreakpoint = exchange.responseBreakpoint!;

            cards.push(this.renderApiCard(apiName, apiExchange));
            cards.push(<ExchangeRequestCard
                {...this.cardProps.request}
                exchange={exchange}
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

    private renderNormalCards(
        exchange: HttpExchange,
        apiName: string | undefined,
        apiExchange: ApiExchange | undefined
    ) {
        const { uiStore } = this.props;
        const { response } = exchange;

        const cards: Array<JSX.Element | null> = [];

        cards.push(this.renderApiCard(apiName, apiExchange));

        cards.push(<ExchangeRequestCard
            {...this.cardProps.request}
            exchange={exchange}
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
            !t.startsWith('passthrough-tls-error:') &&
            !t.startsWith('client-error:') &&
            !['header-overflow', 'http-2'].includes(t)
        );
    }

};