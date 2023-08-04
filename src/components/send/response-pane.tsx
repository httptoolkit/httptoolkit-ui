import * as React from "react";
import { inject, observer } from "mobx-react";
import * as portals from 'react-reverse-portal';

import { styled } from '../../styles';
import { HttpExchange } from "../../types";

import { UiStore } from '../../model/ui/ui-store';
import { AccountStore } from '../../model/account/account-store';

import { ThemedContainerSizedEditor } from '../editor/base-editor';
import { LoadingCard } from '../common/loading-card';
import { HttpAbortedResponseCard } from '../view/http/http-aborted-card';

import { ResponseStatusSection } from './sent-response-status';
import { SentResponseHeaderSection } from './sent-response-headers';
import { SentResponseBodyCard } from './sent-response-body';

const ResponsePaneContainer = styled.section`
    display: flex;
    flex-direction: column;
    height: 100%;
`;

@inject('uiStore')
@inject('accountStore')
@observer
export class ResponsePane extends React.Component<{
    uiStore?: UiStore,
    accountStore?: AccountStore,

    exchange: HttpExchange | undefined,
    editorNode: portals.HtmlPortalNode<typeof ThemedContainerSizedEditor>
}> {

    get cardProps() {
        return this.props.uiStore!.sendCardProps;
    }

    render() {
        const { exchange, uiStore, editorNode } = this.props;
        if (!exchange) return null;

        if (exchange.isSuccessfulExchange()) {
            const response = exchange.response;
            return <ResponsePaneContainer>
                <ResponseStatusSection
                    exchange={exchange}
                    theme={uiStore!.theme}
                />
                <SentResponseHeaderSection
                    requestUrl={exchange.request.parsedUrl}
                    headers={response.rawHeaders}
                    {...this.cardProps.responseHeaders}
                />
                <SentResponseBodyCard
                    {...this.cardProps.responseBody}
                    isPaidUser={this.props.accountStore!.isPaidUser}
                    url={exchange.request.url}
                    message={response}
                    editorNode={editorNode}
                />
            </ResponsePaneContainer>;
        } else if (exchange.isCompletedExchange()) {
            return <ResponsePaneContainer>
                <HttpAbortedResponseCard
                    cardProps={this.cardProps.responseHeaders}
                    exchange={exchange}
                />
            </ResponsePaneContainer>
        } else {
            return <ResponsePaneContainer>
                <LoadingCard {...this.cardProps.responseHeaders}>
                    <header>
                        <h1>Response...</h1>
                    </header>
                </LoadingCard>
            </ResponsePaneContainer>;
        }
    }

}