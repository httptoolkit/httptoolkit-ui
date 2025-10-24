import * as React from 'react';
import { action } from 'mobx';
import { inject, observer } from 'mobx-react';
import * as portals from 'react-reverse-portal';
import * as HarFormat from 'har-format';

import { styled } from '../../styles';
import { useHotkeys } from '../../util/ui';
import { WithInjected } from '../../types';

import { ApiError } from '../../services/server-api-types';
import { SendStore } from '../../model/send/send-store';
import { UiStore } from '../../model/ui/ui-store';
import { buildRequestInputFromHarRequest } from '../../model/send/send-request-model';

import { ContainerSizedEditor } from '../editor/base-editor';

import { SplitPane } from '../split-pane';
import { SendTabs, TAB_BAR_HEIGHT } from './send-tabs';
import { RequestPane } from './request-pane';
import { ResponsePane } from './response-pane';

const SendPageContainer = styled.div`
    height: 100vh;
    position: relative;
    background-color: ${p => p.theme.mainBackground};
`;

const TabContentContainer = styled.div`
    position: relative;
    height: calc(100vh - ${TAB_BAR_HEIGHT});
    box-shadow: 0 -2px 5px 1px rgba(0,0,0,${p => p.theme.boxShadowAlpha});
`;

const SendPageKeyboardShortcuts = (props: {
    onMoveSelection: (distance: number) => void,
    onCloseTab: () => void,
    onAbortRequest?: () => void
}) => {
    useHotkeys('Ctrl+Tab, Cmd+Tab', () => {
        props.onMoveSelection(1);
    }, [props.onMoveSelection]);

    useHotkeys('Ctrl+Shift+Tab, Cmd+Shift+Tab', () => {
        props.onMoveSelection(-1);
    }, [props.onMoveSelection]);

    useHotkeys('Ctrl+w, Cmd+w', () => {
        props.onCloseTab();
    }, [props.onCloseTab]);

    useHotkeys('Escape', () => {
        if (props.onAbortRequest) props.onAbortRequest();
    }, [props.onAbortRequest]);

    return null;
};

@inject('sendStore')
@inject('uiStore')
@observer
class SendPage extends React.Component<{
    sendStore: SendStore,
    uiStore: UiStore,
    navigate: (path: string) => void
}> {

    private requestEditorNode = portals.createHtmlPortalNode<typeof ContainerSizedEditor>({
        attributes: { 'style': 'height: 100%' }
    });
    private responseEditorNode = portals.createHtmlPortalNode<typeof ContainerSizedEditor>({
        attributes: { 'style': 'height: 100%' }
    });

    private sendRequest = () => {
        const {
            sendRequest,
            selectedRequest
        } = this.props.sendStore;

        sendRequest(selectedRequest).catch(e => {
            console.log(e);
            const errorMessage = (e instanceof ApiError && e.apiError?.message)
                ? e.apiError?.message
                : e.message ?? e;
            alert(errorMessage);
        });
    };

    private deleteSelectedRequest = () => {
        const { deleteRequest, selectedRequest } = this.props.sendStore;
        deleteRequest(selectedRequest);
    }

    private showRequestOnViewPage = () => {
        const { sentExchange } = this.props.sendStore.selectedRequest;
        if (!sentExchange) return;

        const { navigate } = this.props;

        navigate(`/view/${sentExchange.id}`);
    }

    render() {
        const {
            sendRequests,
            selectRequest,
            moveSelection,
            deleteRequest,
            selectedRequest,
            addRequestInput
        } = this.props.sendStore;

        const {
            handleContextMenuEvent
        } = this.props.uiStore;

        return <SendPageContainer>
            <SendTabs
                sendRequests={sendRequests}
                selectedTab={selectedRequest}
                onSelectTab={selectRequest}
                onMoveSelection={moveSelection}
                onCloseTab={deleteRequest}
                onAddTab={addRequestInput}
                onContextMenu={handleContextMenuEvent}
            />

            <SendPageKeyboardShortcuts
                onCloseTab={this.deleteSelectedRequest}
                onMoveSelection={moveSelection}
                onAbortRequest={selectedRequest?.pendingSend?.abort}
            />

            <TabContentContainer
                id='send-tabpanel'
                role='tabpanel'
            >
                <SplitPane
                    split='vertical'
                    primary='second'
                    defaultSize='50%'
                    minSize={300}
                    maxSize={-300}
                >
                    <RequestPane
                        requestInput={selectedRequest.request}
                        sendRequest={this.sendRequest}
                        isSending={
                            selectedRequest.pendingSend?.promise.state === 'pending'
                        }
                        editorNode={this.requestEditorNode}
                        updateFromHar={this.updateFromHar}
                    />
                    <ResponsePane
                        requestInput={selectedRequest.request}
                        exchange={selectedRequest.sentExchange}
                        abortRequest={selectedRequest.pendingSend?.abort}
                        showRequestOnViewPage={selectedRequest.sentExchange
                            ? this.showRequestOnViewPage
                            : undefined
                        }
                        editorNode={this.responseEditorNode}
                    />
                </SplitPane>
            </TabContentContainer>

            <portals.InPortal node={this.requestEditorNode}>
                <ContainerSizedEditor contentId={null} />
            </portals.InPortal>
            <portals.InPortal node={this.responseEditorNode}>
                <ContainerSizedEditor contentId={null} />
            </portals.InPortal>
        </SendPageContainer>;
    }

    @action.bound
    updateFromHar(harRequest: HarFormat.Request) {
        const { selectedRequest } = this.props.sendStore;
        selectedRequest.request = buildRequestInputFromHarRequest(harRequest);
    }

}

// Annoying cast required to handle the store prop nicely in our types
const InjectedSendPage = SendPage as unknown as WithInjected<
    typeof SendPage,
    'sendStore' | 'uiStore' | 'navigate'
>;
export { InjectedSendPage as SendPage };