import * as React from 'react';
import { inject, observer } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { UiStore } from '../../../model/ui-store';
import { RTCConnection } from '../../../model/webrtc/rtc-connection';
import { ThemedSelfSizedEditor } from '../../editor/base-editor';

import { PaneOuterContainer, PaneScrollContainer } from '../view-details-pane';
import { RTCConnectionCard } from './rtc-connection-card';
import { SDPCard } from './sdp-card';

@inject('uiStore')
@observer
export class RTCConnectionDetailsPane extends React.Component<{
    connection: RTCConnection,

    offerEditor: portals.HtmlPortalNode<typeof ThemedSelfSizedEditor>,
    answerEditor: portals.HtmlPortalNode<typeof ThemedSelfSizedEditor>,

    uiStore?: UiStore
}> {

    render() {
        const {
            connection,
            uiStore,
            offerEditor,
            answerEditor
        } = this.props;
        const {
            localSessionDescription,
            remoteSessionDescription
        } = connection;

        const locallyInitiated = localSessionDescription.type === 'offer';

        const offerDescription = locallyInitiated
            ? localSessionDescription
            : remoteSessionDescription;
        const answerDescription = locallyInitiated
            ? remoteSessionDescription
            : localSessionDescription;

        const offerCardProps = {
            ...uiStore!.viewCardProps.rtcSessionOffer,
            direction: locallyInitiated ? 'right' : 'left'
        };

        const answerCardProps = {
            ...uiStore!.viewCardProps.rtcSessionAnswer,
            direction: locallyInitiated ? 'left' : 'right'
        };

        return <PaneOuterContainer>
            <PaneScrollContainer>
                <RTCConnectionCard
                    {...uiStore!.viewCardProps.rtcConnection}
                    connection={connection}
                />
                <SDPCard
                    {...offerCardProps}
                    connection={connection}
                    type={locallyInitiated ? 'local' : 'remote'}
                    sessionDescription={offerDescription}
                    editorNode={offerEditor}
                />
                <SDPCard
                    {...answerCardProps}
                    connection={connection}
                    type={locallyInitiated ? 'remote' : 'local'}
                    sessionDescription={answerDescription}
                    editorNode={answerEditor}
                />
            </PaneScrollContainer>
        </PaneOuterContainer>;
    }

}