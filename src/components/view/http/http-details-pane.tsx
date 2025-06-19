import * as _ from 'lodash';
import * as React from 'react';
import { action, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { CollectedEvent, HtkResponse, HttpExchangeView } from '../../../types';
import { styled } from '../../../styles';
import { logError } from '../../../errors';

import { ContentPerspective, ExpandableViewCardKey, UiStore } from '../../../model/ui/ui-store';
import { RulesStore } from '../../../model/rules/rules-store';
import { AccountStore } from '../../../model/account/account-store';
import { ApiExchange } from '../../../model/api/api-interfaces';
import { buildRuleFromRequest } from '../../../model/rules/rule-creation';
import { findItem } from '../../../model/rules/rules-structure';
import { HtkRule, getRulePartKey } from '../../../model/rules/rules';
import { WebSocketView } from '../../../model/websockets/websocket-views';
import { tagsToErrorType } from '../../../model/http/error-types';

import { PaneScrollContainer } from '../view-details-pane';
import { StreamMessageListCard } from '../stream-message-list-card';
import { WebSocketCloseCard } from '../websocket-close-card';
import { SelfSizedEditor } from '../../editor/base-editor';

import { HttpBodyCard } from './http-body-card';
import { HttpApiCard, HttpApiPlaceholderCard } from './http-api-card';
import { HttpRequestCard } from './http-request-card';
import { HttpResponseCard } from './http-response-card';
import { HttpAbortedResponseCard } from './http-aborted-card';
import { HttpTrailersCard } from './http-trailers-card';
import { HttpPerformanceCard } from './http-performance-card';
import { HttpExportCard } from './http-export-card';
import { HttpErrorHeader } from './http-error-header';
import { HttpDetailsFooter } from './http-details-footer';
import { HttpRequestBreakpointHeader, HttpResponseBreakpointHeader } from './http-breakpoint-header';
import { HttpBreakpointRequestCard } from './http-breakpoint-request-card';
import { HttpBreakpointResponseCard } from './http-breakpoint-response-card';
import { HttpBreakpointBodyCard } from './http-breakpoint-body-card';
import { TransformCard } from './transform-card';

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
    exchange: HttpExchangeView,
    perspective: ContentPerspective,

    requestEditor: portals.HtmlPortalNode<typeof SelfSizedEditor>,
    responseEditor: portals.HtmlPortalNode<typeof SelfSizedEditor>,
    streamMessageEditor: portals.HtmlPortalNode<typeof SelfSizedEditor>,

    navigate: (path: string) => void,
    onDelete: (event: CollectedEvent) => void,
    onScrollToEvent: (event: CollectedEvent) => void,
    onBuildRuleFromExchange: (exchange: HttpExchangeView) => void,
    onPrepareToResendRequest?: (exchange: HttpExchangeView) => void,

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

        // The full API details - for paid APIs, and non-paid users, we don't show
        // the detailed API data in any of the cards, we just show the name (below)
        // in a collapsed API card.
        const apiExchange = (isPaidUser || exchange.apiSpec?.isBuiltInApi)
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
            return <>
                { headerCard }
                { this.renderExpandedCard(expandedViewCard, exchange, apiExchange) }
            </>;
        }

        const cards = (exchange.downstream.isBreakpointed)
            ? this.renderBreakpointCards(exchange, apiName, apiExchange)
            : this.renderNormalCards(exchange, apiName, apiExchange);

        return <>
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
        </>;
    }

    renderHeaderCard(exchange: HttpExchangeView): JSX.Element | null {
        const { accountStore, navigate } = this.props;
        const { isPaidUser, getPro } = accountStore!;
        const {
            requestBreakpoint,
            respondToBreakpointedRequest,
            responseBreakpoint,
            tags
        } = exchange.downstream;

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
            createRuleFromRequest: this.createRuleFromRequest,
            ignoreError: this.ignoreError
        };

        const errorType = tagsToErrorType(tags);

        if (errorType && !exchange.hideErrors) {
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
        exchange: HttpExchangeView,
        apiExchange: ApiExchange | undefined
    ) {
        if (expandedCard === 'requestBody') {
            return this.renderRequestBody(exchange, apiExchange);
        } else if (
            expandedCard === 'responseBody' && (
                exchange.isSuccessfulExchange() ||
                !!exchange.downstream.responseBreakpoint
            )) {
            return this.renderResponseBody(exchange, apiExchange);
        } else if (
            expandedCard === 'webSocketMessages' &&
            exchange.isWebSocket() &&
            exchange.wasAccepted
        ) {
            return this.renderWebSocketMessages(exchange);
        } else {
            logError(`Expanded ${expandedCard}, but can't show anything`);
            return null; // Shouldn't ever happen, unless we get into a funky broken state
        }
    }

    private renderBreakpointCards(
        exchange: HttpExchangeView,
        apiName: string | undefined,
        apiExchange: ApiExchange | undefined
    ) {
        const { uiStore } = this.props;
        const { requestBreakpoint } = exchange.downstream;

        const cards: Array<JSX.Element | null> = [];

        if (requestBreakpoint) {
            cards.push(<HttpBreakpointRequestCard
                {...this.cardProps.request}
                exchange={exchange.downstream}
                onChange={requestBreakpoint.updateMetadata}
            />);

            cards.push(this.renderRequestBody(exchange, apiExchange));
        } else {
            const responseBreakpoint = exchange.downstream.responseBreakpoint!;
            const transformCard = this.renderTransformCard();
            if (transformCard) cards.push(transformCard);

            cards.push(this.renderApiCard(apiName, apiExchange));
            cards.push(<HttpRequestCard
                {...this.cardProps.request}
                matchedRuleData={
                    // Matched rule data is shown inline here only when there
                    // was not any substantial proxy transformation.
                    !transformCard
                    ? this.matchedRuleData
                    : undefined
                }
                onRuleClicked={this.jumpToRule}
                exchange={exchange}
            />);

            if (exchange.hasRequestBody()) {
                cards.push(this.renderRequestBody(exchange, apiExchange));
            }

            cards.push(<HttpBreakpointResponseCard
                {...this.cardProps.response}
                exchange={exchange.downstream}
                onChange={responseBreakpoint.updateMetadata}
                theme={uiStore!.theme}
            />);

            cards.push(this.renderResponseBody(exchange, apiExchange));
        }

        return cards;
    }

    private renderNormalCards(
        exchange: HttpExchangeView,
        apiName: string | undefined,
        apiExchange: ApiExchange | undefined
    ) {
        const { uiStore } = this.props;
        const { response } = exchange;

        const cards: Array<JSX.Element | null> = [];

        const transformCard = this.renderTransformCard();
        if (transformCard) cards.push(transformCard);
        cards.push(this.renderApiCard(apiName, apiExchange));

        cards.push(<HttpRequestCard
            {...this.cardProps.request}
            matchedRuleData={
                // Matched rule data is shown inline here only when there
                // was not any substantial proxy transformation.
                !transformCard
                ? this.matchedRuleData
                : undefined
            }
            onRuleClicked={this.jumpToRule}
            exchange={exchange}
        />);

        if (exchange.hasRequestBody()) {
            cards.push(this.renderRequestBody(exchange, apiExchange));
        }

        if (exchange.request.rawTrailers?.length) {
            cards.push(<HttpTrailersCard
                {...this.cardProps.requestTrailers}
                type='request'
                httpVersion={exchange.httpVersion}
                requestUrl={exchange.request.parsedUrl}
                trailers={exchange.request.rawTrailers}
            />);
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
                httpVersion={exchange.httpVersion}
                response={response}
                requestUrl={exchange.request.parsedUrl}
                apiExchange={apiExchange}
                theme={uiStore!.theme}
            />);

            if (exchange.hasResponseBody()) {
                cards.push(this.renderResponseBody(exchange, apiExchange));
            }

            if (exchange.isSuccessfulExchange() && exchange.response?.rawTrailers?.length) {
                cards.push(<HttpTrailersCard
                    {...this.cardProps.responseTrailers}
                    type='response'
                    httpVersion={exchange.httpVersion}
                    requestUrl={exchange.request.parsedUrl}
                    trailers={exchange.response.rawTrailers}
                />);
            }
        }

        if (exchange.isWebSocket()) {
            if (exchange.wasAccepted) {
                cards.push(this.renderWebSocketMessages(exchange));

                if (exchange.closeState) {
                    cards.push(<WebSocketCloseCard
                        {...this.cardProps.webSocketClose}
                        theme={uiStore!.theme}
                        closeState={exchange.closeState}
                    />);
                }
            }
        } else if (!exchange.tags.some(tag => tag.startsWith('client-error:'))) {
            // We show perf & export only for valid requests, and never for
            // websockets (at least for now):

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

    private renderTransformCard() {
        const { uiStore } = this.props;

        if (!this.props.exchange.upstream?.wasTransformed) return false;

        return <TransformCard
            key='transform'
            matchedRuleData={this.matchedRuleData}
            onRuleClicked={this.jumpToRule}
            uiStore={uiStore!}
        />;
    }

    private renderRequestBody(exchange: HttpExchangeView, apiExchange: ApiExchange | undefined) {
        const { request } = exchange;
        const { requestBreakpoint } = exchange.downstream;

        return requestBreakpoint
            ? <HttpBreakpointBodyCard
                {...this.requestBodyParams()}
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

    private renderResponseBody(exchange: HttpExchangeView, apiExchange: ApiExchange | undefined) {
        const { response } = exchange;
        const { responseBreakpoint } = exchange.downstream;

        return responseBreakpoint
            ? <HttpBreakpointBodyCard
                {...this.responseBodyParams()}
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

    private renderWebSocketMessages(exchange: WebSocketView) {
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
            cardHeading='WebSocket Messages'

            editorNode={this.props.streamMessageEditor}

            isPaidUser={this.props.accountStore!.isPaidUser}
            filenamePrefix={filenamePrefix}
            messages={exchange.messages}
            onClearMessages={this.clearMessages}
        />;
    }

    // The common request body params, for both normal & breakpointed bodies
    private requestBodyParams() {
        return {
            ...this.cardProps.requestBody,
            title: 'Request Body',
            direction: 'right' as const,
            editorKey: `${this.props.exchange.id}-${this.props.perspective}-request`,
            editorNode: this.props.requestEditor
        };
    }

    // The common response body params, for both normal & breakpointed bodies
    private responseBodyParams() {
        return {
            ...this.cardProps.responseBody,
            title: 'Response Body',
            direction: 'left' as const,
            editorKey: `${this.props.exchange.id}-${this.props.perspective}-response`,
            editorNode: this.props.responseEditor
        };
    }

    @action.bound
    private createRuleFromRequest() {
        const { exchange, rulesStore, navigate } = this.props;

        const rule = buildRuleFromRequest(rulesStore!, exchange.request);
        rulesStore!.draftRules.items.unshift(rule);
        navigate(`/modify/${rule.id}`);
    }

    @computed
    private get matchedRuleData() {
        const { exchange, rulesStore } = this.props;

        const { matchedRule } = exchange;
        if (!matchedRule) return;

        const currentRuleDraft = findItem(rulesStore!.draftRules, { id: matchedRule.id }) as HtkRule | undefined;
        if (!currentRuleDraft) {
            return { stepTypes: matchedRule.stepTypes, status: 'deleted' } as const;
        }

        const currentStepTypes = currentRuleDraft.steps.map(s => getRulePartKey(s));

        if (!_.isEqual(currentStepTypes, matchedRule.stepTypes)) {
            return { stepTypes: matchedRule.stepTypes, status: 'modified-types' } as const;
        }

        return { stepTypes: matchedRule.stepTypes, status: 'unchanged' } as const;
    }

    @action.bound
    private jumpToRule() {
        const { navigate, exchange } = this.props;
        const { matchedRule } = exchange;
        if (!matchedRule) return;
        navigate(`/modify/${matchedRule.id}`);
    }

    @action.bound
    private ignoreError() {
        const { exchange } = this.props;
        exchange.hideErrors = true;
    }

    @action.bound
    private clearMessages() {
        const { exchange } = this.props;
        if (!exchange.isWebSocket()) return;
        exchange.downstream.clearMessages();
    }

};