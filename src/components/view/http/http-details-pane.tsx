import * as _ from 'lodash';
import * as React from 'react';
import { action, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { CollectedEvent, HtkResponse, HttpExchange } from '../../../types';
import { styled } from '../../../styles';
import { logError } from '../../../errors';

import { ExpandableViewCardKey, UiStore } from '../../../model/ui/ui-store';
import { RulesStore } from '../../../model/rules/rules-store';
import { AccountStore } from '../../../model/account/account-store';
import { ApiExchange } from '../../../model/api/api-interfaces';
import { buildRuleFromRequest } from '../../../model/rules/rule-creation';
import { findItem } from '../../../model/rules/rules-structure';
import { HtkMockRule, getRulePartKey } from '../../../model/rules/rules';
import { WebSocketStream } from '../../../model/websockets/websocket-stream';
import { tagsToErrorType } from '../../../model/http/error-types';

import { PaneOuterContainer, PaneScrollContainer } from '../view-details-pane';
import { StreamMessageListCard } from '../stream-message-list-card';
import { WebSocketCloseCard } from '../websocket-close-card';

import { HttpBodyCard } from './http-body-card';
import { HttpApiCard, HttpApiPlaceholderCard } from './http-api-card';
import { HttpRequestCard } from './http-request-card';
import { HttpResponseCard } from './http-response-card';
import { HttpAbortedResponseCard } from './http-aborted-card';
import { HttpPerformanceCard } from './http-performance-card';
import { HttpExportCard } from './http-export-card';
import { SelfSizedEditor } from '../../editor/base-editor';
import { HttpErrorHeader } from './http-error-header';
import { HttpDetailsFooter } from './http-details-footer';
import { HttpRequestBreakpointHeader, HttpResponseBreakpointHeader } from './http-breakpoint-header';
import { HttpBreakpointRequestCard } from './http-breakpoint-request-card';
import { HttpBreakpointResponseCard } from './http-breakpoint-response-card';
import { HttpBreakpointBodyCard } from './http-breakpoint-body-card';

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

@inject('uiStore')
@inject('accountStore')
@inject('rulesStore')
@observer
export class HttpDetailsPane extends React.Component<{
    exchange: HttpExchange,

    requestEditor: portals.HtmlPortalNode<typeof SelfSizedEditor>,
    responseEditor: portals.HtmlPortalNode<typeof SelfSizedEditor>,
    streamMessageEditor: portals.HtmlPortalNode<typeof SelfSizedEditor>,

    navigate: (path: string) => void,
    onDelete: (event: CollectedEvent) => void,
    onScrollToEvent: (event: CollectedEvent) => void,
    onBuildRuleFromExchange: (exchange: HttpExchange) => void,
    onPrepareToResendRequest?: (exchange: HttpExchange) => void,

    // Injected:
    uiStore?: UiStore,
    accountStore?: AccountStore,
    rulesStore?: RulesStore
}> {

    get cardProps() {
        return this.props.uiStore!.viewCardProps;
    }

    render() {
        const {
            exchange,
            onDelete,
            onScrollToEvent,
            onBuildRuleFromExchange,
            onPrepareToResendRequest,
            uiStore,
            accountStore,
            navigate
        } = this.props;

        const { isPaidUser } = accountStore!;
        const { expandedViewCard } = uiStore!;
        const { requestBreakpoint, responseBreakpoint } = exchange;

        // The full API details - for paid APIs, and non-paid users, we don't show
        // the detailed API data in any of the cards, we just show the name (below)
        // in a collapsed API card.
        const apiExchange = (isPaidUser || exchange.api?.isBuiltInApi)
            ? exchange.api
            : undefined;

        // We do still want the API name though, if there is one - we use this to
        // show non-paid users when API data might be available, iff this request
        // does actually match a documented operation.
        const apiName = exchange.api?.matchedOperation()
            ? makeFriendlyApiName(exchange.api.service.name)
            : undefined;

        const headerCard = this.renderHeaderCard(exchange);

        if (expandedViewCard) {
            return <PaneOuterContainer>
                { headerCard }
                { this.renderExpandedCard(expandedViewCard, exchange, apiExchange) }
            </PaneOuterContainer>;
        }

        const cards = (requestBreakpoint || responseBreakpoint)
            ? this.renderBreakpointCards(exchange, apiName, apiExchange)
            : this.renderNormalCards(exchange, apiName, apiExchange);

        return <PaneOuterContainer>
            <PaneScrollContainer>
                { headerCard }
                { cards }
            </PaneScrollContainer>
            <HttpDetailsFooter
                event={exchange}
                onDelete={onDelete}
                onScrollToEvent={onScrollToEvent}
                onBuildRuleFromExchange={onBuildRuleFromExchange}
                onPrepareToResendRequest={onPrepareToResendRequest}
                navigate={navigate}
                isPaidUser={isPaidUser}
            />
        </PaneOuterContainer>;
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
            return <HttpRequestBreakpointHeader
                key='breakpoint-header'
                onCreateResponse={respondToBreakpointedRequest}
                onResume={requestBreakpoint.resume}
                onClose={requestBreakpoint.close}
            />;
        }

        if (responseBreakpoint) {
            return <HttpResponseBreakpointHeader
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
            return <HttpErrorHeader type={errorType} {...errorHeaderProps} />;
        } else {
            return null;
        }
    }

    private renderApiCard(
        apiName: string | undefined,
        apiExchange: ApiExchange | undefined
    ) {
        if (!apiName) return null;

        if (!apiExchange) {
            // If you're not a paid user, and it's a paid API, then we only have
            // the basic API name here but no details, so we just show a placeholder:
            return <HttpApiPlaceholderCard
                {...this.cardProps.api}
                apiName={apiName}
            />;
        }

        // If paid/built-in API & we have a name, we must have full API details, show them:
        return <HttpApiCard
            {...this.cardProps.api}
            apiName={apiName}
            apiExchange={apiExchange!}
        />;
    }

    private renderExpandedCard(
        expandedCard: ExpandableViewCardKey,
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
        } else if (
            expandedCard === 'webSocketMessages' &&
            exchange.isWebSocket() &&
            exchange.wasAccepted()
        ) {
            return this.renderWebSocketMessages(exchange);
        } else {
            logError(`Expanded ${expandedCard}, but can't show anything`);
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
            cards.push(<HttpBreakpointRequestCard
                {...this.cardProps.request}
                exchange={exchange}
                onChange={requestBreakpoint.updateMetadata}
            />);

            cards.push(this.renderRequestBody(exchange, apiExchange));
        } else {
            const responseBreakpoint = exchange.responseBreakpoint!;

            cards.push(this.renderApiCard(apiName, apiExchange));
            cards.push(<HttpRequestCard
                {...this.cardProps.request}
                matchedRuleData={this.matchedRuleData}
                onRuleClicked={this.jumpToRule}
                exchange={exchange}
            />);

            if (exchange.hasRequestBody()) {
                cards.push(this.renderRequestBody(exchange, apiExchange));
            }

            cards.push(<HttpBreakpointResponseCard
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

        cards.push(<HttpRequestCard
            {...this.cardProps.request}
            matchedRuleData={this.matchedRuleData}
            onRuleClicked={this.jumpToRule}
            exchange={exchange}
        />);

        if (exchange.hasRequestBody()) {
            cards.push(this.renderRequestBody(exchange, apiExchange));
        }

        if (response === 'aborted') {
            cards.push(<HttpAbortedResponseCard
                key={this.cardProps.response.key}
                cardProps={this.cardProps.response}
                exchange={exchange}
            />);
        } else if (!!response) {
            cards.push(<HttpResponseCard
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

        if (exchange.isWebSocket() && exchange.wasAccepted()) {
            cards.push(this.renderWebSocketMessages(exchange));

            if (exchange.closeState) {
                cards.push(<WebSocketCloseCard
                    {...this.cardProps.webSocketClose}
                    theme={uiStore!.theme}
                    closeState={exchange.closeState}
                />);
            }
        } else {
            // We only show performance & export for non-websockets, for now:

            // Push all cards below this point to the bottom
            cards.push(<CardDivider key='divider' />);

            cards.push(<HttpPerformanceCard
                exchange={exchange}
                {...this.cardProps.performance}
            />);

            cards.push(<HttpExportCard
                exchange={exchange}
                {...this.cardProps.export}
            />);
        }

        return cards;
    }

    private renderRequestBody(exchange: HttpExchange, apiExchange: ApiExchange | undefined) {
        const { request, requestBreakpoint } = exchange;

        return requestBreakpoint
            ? <HttpBreakpointBodyCard
                {...this.requestBodyParams()}
                exchangeId={exchange.id}
                body={requestBreakpoint.inProgressResult.body}
                rawHeaders={requestBreakpoint.inProgressResult.rawHeaders}
                onChange={requestBreakpoint.updateBody}
            />
            : <HttpBodyCard
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
            ? <HttpBreakpointBodyCard
                {...this.responseBodyParams()}
                exchangeId={exchange.id}
                body={responseBreakpoint.inProgressResult.body}
                rawHeaders={responseBreakpoint.inProgressResult.rawHeaders}
                onChange={responseBreakpoint.updateBody}
            />
            : <HttpBodyCard
                {...this.responseBodyParams()}
                isPaidUser={this.props.accountStore!.isPaidUser}
                url={exchange.request.url}
                message={response as HtkResponse}
                apiBodySchema={apiExchange?.response?.bodySchema}
            />;
    }

    private renderWebSocketMessages(exchange: WebSocketStream) {
        const urlParts = exchange.request.url.split('/');
        const domain = urlParts[2].split(':')[0];
        const baseName = urlParts.length >= 2 ? urlParts[urlParts.length - 1] : undefined;

        const filenamePrefix = `${domain}${baseName ? `- ${baseName}` : ''} - websocket`;

        return <StreamMessageListCard
            {...this.cardProps.webSocketMessages}

            // Link the key to the exchange, to ensure selected-message state gets
            // reset when we switch between exchanges:
            key={`${this.cardProps.webSocketMessages.key}-${this.props.exchange.id}`}
            streamId={this.props.exchange.id}
            streamType='WebSocket'

            editorNode={this.props.streamMessageEditor}

            isPaidUser={this.props.accountStore!.isPaidUser}
            filenamePrefix={filenamePrefix}
            messages={exchange.messages}
        />;
    }

    // The common request body params, for both normal & breakpointed bodies
    private requestBodyParams() {
        return {
            ...this.cardProps.requestBody,
            title: 'Request Body',
            direction: 'right' as const,
            editorNode: this.props.requestEditor
        };
    }

    // The common response body params, for both normal & breakpointed bodies
    private responseBodyParams() {
        return {
            ...this.cardProps.responseBody,
            title: 'Response Body',
            direction: 'left' as const,
            editorNode: this.props.responseEditor
        };
    }

    @action.bound
    private mockRequest() {
        const { exchange, rulesStore, navigate } = this.props;

        const rule = buildRuleFromRequest(rulesStore!, exchange.request);
        rulesStore!.draftRules.items.unshift(rule);
        navigate(`/mock/${rule.id}`);
    }

    @computed
    private get matchedRuleData() {
        const { exchange, rulesStore } = this.props;

        const { matchedRule } = exchange;
        if (!matchedRule) return;

        const currentRuleDraft = findItem(rulesStore!.draftRules, { id: matchedRule.id }) as HtkMockRule | undefined;
        if (!currentRuleDraft) {
            return { stepTypes: matchedRule.handlerStepTypes, status: 'deleted' } as const;
        }

        const currentStepTypes = ('handler' in currentRuleDraft
            ? [currentRuleDraft.handler]
            : currentRuleDraft.steps
        ).map(s => getRulePartKey(s));

        if (!_.isEqual(currentStepTypes, matchedRule.handlerStepTypes)) {
            return { stepTypes: matchedRule.handlerStepTypes, status: 'modified-types' } as const;
        }

        return { stepTypes: matchedRule.handlerStepTypes, status: 'unchanged' } as const;
    }

    @action.bound
    private jumpToRule() {
        const { navigate, exchange } = this.props;
        const { matchedRule } = exchange;
        if (!matchedRule) return;
        navigate(`/mock/${matchedRule.id}`);
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