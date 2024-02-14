/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import * as React from 'react';
import { action, computed, observable } from 'mobx';
import { inject, observer } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { UiStore } from '../../../model/ui/ui-store';
import { AccountStore } from '../../../model/account/account-store';
import { RTCConnection } from '../../../model/webrtc/rtc-connection';
import { RTCDataChannel } from '../../../model/webrtc/rtc-data-channel';
import { RTCMediaTrack } from '../../../model/webrtc/rtc-media-track';

import { SelfSizedEditor } from '../../editor/base-editor';
import { PaneOuterContainer, PaneScrollContainer } from '../view-details-pane';

import { RTCConnectionCard } from './rtc-connection-card';
import { SDPCard } from './sdp-card';
import { RTCDataChannelCard } from './rtc-data-channel-card';
import { RTCMediaCard } from './rtc-media-card';

@inject('uiStore')
@inject('accountStore')
@observer
export class RTCConnectionDetailsPane extends React.Component<{
    connection: RTCConnection,

    offerEditor: portals.HtmlPortalNode<typeof SelfSizedEditor>,
    answerEditor: portals.HtmlPortalNode<typeof SelfSizedEditor>,

    navigate: (path: string) => void,

    uiStore?: UiStore,
    accountStore?: AccountStore
}> {

    @computed.struct
    get mediaTracks() {
        const { streams } = this.props.connection;
        return streams.filter((s): s is RTCMediaTrack => s.isRTCMediaTrack());
    }

    @computed.struct
    get dataChannels() {
        const { streams } = this.props.connection;
        return streams.filter((s): s is RTCDataChannel => s.isRTCDataChannel());
    }

    // Create a editor portal node for every data channel.
    private readonly dataChannelEditors = this.dataChannels.map(() =>
        portals.createHtmlPortalNode<typeof SelfSizedEditor>()
    );

    @observable
    private streamCardState: {
        [streamId: string]: { collapsed: boolean } | undefined
    } = {};

    @action.bound
    toggleCollapse(streamId: string) {
        this.streamCardState[streamId] = {
            collapsed: !this.streamCardState[streamId]?.collapsed ?? true
        };
    }

    expandStream(streamId: string) {
        this.props.navigate(`/view/${streamId}`);
    }

    render() {
        const {
            connection,
            uiStore,
            offerEditor,
            answerEditor,
            accountStore
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
        } as const;

        const answerCardProps = {
            ...uiStore!.viewCardProps.rtcSessionAnswer,
            direction: locallyInitiated ? 'left' : 'right'
        } as const;

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

                {
                    this.mediaTracks.map((mediaTrack) =>
                        <RTCMediaCard
                            // Link the key to the track, to ensure selected-message state gets
                            // reset when we switch between traffic:
                            key={mediaTrack.id}

                            mediaTrack={mediaTrack}

                            expanded={false}
                            collapsed={!!this.streamCardState[mediaTrack.id]?.collapsed}
                            onCollapseToggled={this.toggleCollapse.bind(this, mediaTrack.id)}
                            onExpandToggled={this.expandStream.bind(this, mediaTrack.id)}
                            ariaLabel='RTC Media Stream Section'
                        />
                    )
                }

                {
                    this.dataChannels.map((dataChannel, i) =>
                        <RTCDataChannelCard
                            key={dataChannel.id}
                            dataChannel={dataChannel}
                            isPaidUser={accountStore!.isPaidUser}
                            streamMessageEditor={this.dataChannelEditors[i]}

                            expanded={false}
                            collapsed={!!this.streamCardState[dataChannel.id]?.collapsed}
                            onCollapseToggled={this.toggleCollapse.bind(this, dataChannel.id)}
                            onExpandToggled={this.expandStream.bind(this, dataChannel.id)}
                            ariaLabel='RTC Data Messages Section'
                        />
                    )
                }

                { this.dataChannelEditors.map((node, i) =>
                    <portals.InPortal key={i} node={node}>
                        <SelfSizedEditor
                            contentId={null}
                        />
                    </portals.InPortal>
                )}
            </PaneScrollContainer>
        </PaneOuterContainer>;
    }

}