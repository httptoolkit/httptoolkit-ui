import * as React from "react";
import { inject, observer } from "mobx-react";
import * as portals from 'react-reverse-portal';

import { HttpExchange } from "../../types";
import { logError } from "../../errors";

import { UiStore } from '../../model/ui/ui-store';
import { AccountStore } from '../../model/account/account-store';
import { CompletedExchange, SuccessfulExchange } from "../../model/http/exchange";
import { RequestInput } from "../../model/send/send-request-model";
import { tagsToErrorType } from "../../model/http/error-types";

import { ContainerSizedEditor } from '../editor/base-editor';

import { SendCardContainer } from './send-card-section';
import { FailedResponseStatusSection, PendingResponseStatusSection, ResponseStatusSection } from './sent-response-status';
import { PendingResponseHeaderSection, SentResponseHeaderSection } from './sent-response-headers';
import { SentResponseBodyCard } from './sent-response-body';
import { SentResponseError } from './sent-response-error';
@inject('uiStore')
@inject('accountStore')
@observer
export class ResponsePane extends React.Component<{
    uiStore?: UiStore,
    accountStore?: AccountStore,

    requestInput: RequestInput,
    exchange: HttpExchange | undefined,
    editorNode: portals.HtmlPortalNode<typeof ContainerSizedEditor>
}> {

    get cardProps() {
        return this.props.uiStore!.sendCardProps;
    }

    render() {
        const { exchange, uiStore } = this.props;
        if (!exchange) return null;

        return <SendCardContainer
            hasExpandedChild={!!uiStore?.expandedSentResponseCard}
        >
            {
                exchange.isSuccessfulExchange()
                    ? this.renderSuccessfulResponse(exchange)
                : exchange.isCompletedExchange()
                    ? this.renderFailedResponse(exchange)
                : this.renderInProgressResponse()
            }
        </SendCardContainer>;
    }

    renderSuccessfulResponse(exchange: SuccessfulExchange) {
        const { uiStore, editorNode } = this.props;
        const response = exchange.response;

        return <>
            <ResponseStatusSection
                exchange={exchange}
                theme={uiStore!.theme}
            />
            <SentResponseHeaderSection
                {...this.cardProps.responseHeaders}
                requestUrl={exchange.request.parsedUrl}
                headers={response.rawHeaders}
            />
            <SentResponseBodyCard
                {...this.cardProps.responseBody}
                isPaidUser={this.props.accountStore!.isPaidUser}
                url={exchange.request.url}
                message={response}
                editorNode={editorNode}
            />
        </>;

    }

    renderFailedResponse(exchange: CompletedExchange) {
        const { uiStore } = this.props;

        const errorType = tagsToErrorType(exchange.tags);

        if (!errorType) {
            logError(`Sent response failed with no error tags: ${
                JSON.stringify(exchange.tags)
            } (${exchange.abortMessage})`);
        }

        return <>
            <FailedResponseStatusSection
                exchange={exchange}
                errorType={errorType ?? 'unknown'}
                theme={uiStore!.theme}
            />
            <SentResponseError
                errorType={errorType ?? 'unknown'}
                errorMessage={exchange.abortMessage}
            />
        </>;
    }

    renderInProgressResponse() {
        const { uiStore, editorNode, requestInput } = this.props;

        return <>
            <PendingResponseStatusSection
                theme={uiStore!.theme}
            />
            <PendingResponseHeaderSection
                {...this.cardProps.responseHeaders}
            />
            <SentResponseBodyCard
                {...this.cardProps.responseBody}
                isPaidUser={this.props.accountStore!.isPaidUser}
                url={requestInput.url}
                editorNode={editorNode}
            />
        </>
    }

}