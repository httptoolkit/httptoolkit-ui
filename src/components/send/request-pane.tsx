import * as _ from 'lodash';
import * as React from 'react';
import { action, reaction } from 'mobx';
import { disposeOnUnmount, inject, observer } from 'mobx-react';
import * as portals from 'react-reverse-portal';
import * as HarFormat from 'har-format';

import { RawHeaders } from '../../types';

import { RulesStore } from '../../model/rules/rules-store';
import { UiStore } from '../../model/ui/ui-store';
import { RequestInput } from '../../model/send/send-request-model';
import { EditableContentType } from '../../model/events/content-types';

import { ContainerSizedEditor } from '../editor/base-editor';
import { useHotkeys } from '../../util/ui';

import { SendCardContainer } from './send-card-section';
import { SendRequestLine } from './send-request-line';
import { SendRequestHeadersCard } from './send-request-headers-card';
import { SendRequestBodyCard } from './send-request-body-card';

// Layout here is tricky. Current setup seems to work (flex grow & shrink everywhere,
// card basis: auto and min-height: 0, with editor 50% + min-height, and then
// overflow-y: auto and basis: auto on the card contents too).
//
// It's worth reiterating the UI goals here explicitly for reference
// - When multiple areas are open & full+, the area is split even-ish with scrolling
//   in any areas required
// - When areas are closed, remaining areas expand to the space, even if unused
// - When multiple areas are open, if there is spare space (e.g. few headers), the
//   other areas that need it (body editor) expand and use the space.

const METHODS_WITHOUT_BODY = [
    'GET',
    'HEAD',
    'OPTIONS'
];

const RequestPaneKeyboardShortcuts = (props: {
    sendRequest: () => void
}) => {
    useHotkeys('Ctrl+Enter, Cmd+Enter', (event) => {
        props.sendRequest()
    }, [props.sendRequest]);

    return null;
};

@inject('rulesStore')
@inject('uiStore')
@observer
export class RequestPane extends React.Component<{
    rulesStore?: RulesStore,
    uiStore?: UiStore,

    editorNode: portals.HtmlPortalNode<typeof ContainerSizedEditor>,

    requestInput: RequestInput,
    sendRequest: () => void,
    isSending: boolean,
    updateFromHar: (harRequest: HarFormat.Request) => void
}> {

    get cardProps() {
        return this.props.uiStore!.sendCardProps;
    }

    componentDidMount() {
        // Auto-collapse the body if you pick a body-less HTTP method
        disposeOnUnmount(this, reaction(() => this.props.requestInput.method, (method) => {
            // If the body is empty, match the open/closed status to the method:
            if (METHODS_WITHOUT_BODY.includes(method)) {
                // If there's a body entered, don't mess with it
                if (this.props.requestInput.rawBody.decoded.length > 0) return;
                else if (this.cardProps.requestBody.collapsed) return;
                else this.cardProps.requestBody.onCollapseToggled();
            } else {
                if (!this.cardProps.requestBody.collapsed) return;
                this.cardProps.requestBody.onCollapseToggled();
            }
        }, { fireImmediately: true }));
    }

    render() {
        const {
            requestInput,
            sendRequest,
            isSending,
            editorNode,
            uiStore
        } = this.props;

        return <SendCardContainer
            hasExpandedChild={!!uiStore?.expandedSendRequestCard}
        >
            <RequestPaneKeyboardShortcuts
                sendRequest={sendRequest}
            />

            <SendRequestLine
                method={requestInput.method}
                updateMethod={this.updateMethod}
                url={requestInput.url}
                updateUrl={this.updateUrl}
                isSending={isSending}
                sendRequest={sendRequest}
                updateFromHar={this.props.updateFromHar}
            />
            <SendRequestHeadersCard
                {...this.cardProps.requestHeaders}
                headers={requestInput.headers}
                updateHeaders={this.updateHeaders}
            />
            <SendRequestBodyCard
                {...this.cardProps.requestBody}
                headers={requestInput.headers}
                contentType={requestInput.requestContentType}
                onContentTypeUpdated={this.updateRequestContentType}
                body={requestInput.rawBody}
                onBodyUpdated={this.updateBody}
                editorNode={editorNode}
            />
        </SendCardContainer>;
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
    updateRequestContentType(contentType: EditableContentType) {
        const { requestInput } = this.props;
        requestInput.requestContentType = contentType;
    }

    @action.bound
    updateBody(input: Buffer) {
        const { requestInput } = this.props;
        requestInput.rawBody.updateDecodedBody(input);
    }

}