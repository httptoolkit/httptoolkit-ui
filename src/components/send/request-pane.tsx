import * as _ from 'lodash';
import * as React from 'react';
import { action, flow, observable } from 'mobx';
import { disposeOnUnmount, inject, observer } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { RawHeaders } from '../../types';
import { css, styled } from '../../styles';

import { RulesStore } from '../../model/rules/rules-store';
import { UiStore } from '../../model/ui/ui-store';
import { RequestInput } from '../../model/send/send-request-model';
import { syncUrlToHeaders } from '../../model/http/editable-request-parts';

import { ContainerSizedEditor } from '../editor/base-editor';
import { SendRequestLine } from './send-request-line';
import { SendRequestHeadersCard } from './send-request-headers-card';
import { SendRequestBodyCard } from './send-request-body-card';

const RequestPaneContainer = styled.section<{
    hasExpandedChild: boolean
}>`
    display: flex;
    flex-direction: column;
    height: 100%;

    ${p => p.hasExpandedChild && css`
        > * {
            /* CollapsibleCard applies its own display property to override this for the expanded card */
            display: none;
        }
    `}
`;

// Layout here is tricky. Current setup seems to work (flex hrink everywhere, grow bodies,
// card basis: auto, and min-height: 0, with editor 50% + min-height, and then
// overflow-y: auto and basis: auto on the card contents too).
//
// It's worth reiterating the UI goals here explicitly for reference
// - When multiple areas are open & full+, the area is split even-ish with scrolling
//   in any areas required
// - When areas are closed, body areas expand to the space, otherwise it collapses upwards
// - When multiple areas are open, if there is spare space (e.g. few headers), the
//   other areas that need it (body editor) expand and use the space.

@inject('rulesStore')
@inject('uiStore')
@observer
export class RequestPane extends React.Component<{
    rulesStore?: RulesStore,
    uiStore?: UiStore,

    editorNode: portals.HtmlPortalNode<typeof ContainerSizedEditor>,

    requestInput: RequestInput,
    sendRequest: (requestInput: RequestInput) => void
}> {

    get cardProps() {
        return this.props.uiStore!.sendCardProps;
    }

    componentDidMount() {
        disposeOnUnmount(this, syncUrlToHeaders(
            () => this.props.requestInput.url,
            () => this.props.requestInput.headers
        ));
    }

    render() {
        const { requestInput, editorNode, uiStore } = this.props;

        return <RequestPaneContainer hasExpandedChild={!!uiStore?.expandedSendRequestCard}>
            <SendRequestLine
                method={requestInput.method}
                updateMethod={this.updateMethod}
                url={requestInput.url}
                updateUrl={this.updateUrl}
                isSending={this.isSending}
                sendRequest={this.sendRequest}
            />
            <SendRequestHeadersCard
                {...this.cardProps.requestHeaders}
                headers={requestInput.headers}
                updateHeaders={this.updateHeaders}
            />
            <SendRequestBodyCard
                {...this.cardProps.requestBody}
                body={requestInput.rawBody.decoded}
                onBodyUpdated={this.updateBody}
                editorNode={editorNode}
            />
        </RequestPaneContainer>;
    }

    @action.bound
    updateMethod(method: string) {
        this.props.requestInput.method = method;
    }

    @action.bound
    updateUrl(url: string) {
        this.props.requestInput.url = url;
    }

    @action.bound
    updateHeaders(headers: RawHeaders) {
        const { requestInput } = this.props;
        requestInput.headers = headers;
    }

    @action.bound
    updateBody(input: Buffer) {
        const { requestInput } = this.props;
        requestInput.rawBody.updateDecodedBody(input);
    }

    @observable
    private isSending = false;

    sendRequest = flow(function * (this: RequestPane) {
        if (this.isSending) return;

        this.isSending = true;

        try {
            yield this.props.sendRequest(this.props.requestInput);
        } catch (e) {
            console.warn('Sending request failed', e);
        } finally {
            this.isSending = false;
        }
    }).bind(this);

}