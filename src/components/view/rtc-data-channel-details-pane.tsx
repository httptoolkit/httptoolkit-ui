import * as _ from 'lodash';
import * as React from 'react';
import { observer, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { styled } from '../../styles';

import { AccountStore } from '../../model/account/account-store';
import { RTCDataChannel } from '../../model/webrtc/rtc-data-channel';

import { ThemedSelfSizedEditor } from '../editor/base-editor';

import { StreamMessageListCard } from './stream-message-list-card';

const ExpandedContentContainer = styled.div`
    padding: 0;
    transition: padding 0.1s;

    box-sizing: border-box;
    height: 100%;
    width: 100%;

    display: flex;
    flex-direction: column;
`;

@inject('accountStore')
@observer
export class RTCDataChannelDetailsPane extends React.Component<{
    dataChannel: RTCDataChannel,

    streamMessageEditor: portals.HtmlPortalNode<typeof ThemedSelfSizedEditor>,

    // Injected:
    accountStore?: AccountStore
}> {

    render() {
        const {
            dataChannel
        } = this.props;

        return <ExpandedContentContainer>
            <StreamMessageListCard
                collapsed={false}

                // Link the key to the channel, to ensure selected-message state gets
                // reset when we switch between traffic:
                key={dataChannel.id}
                streamId={dataChannel.id}
                streamType='DataChannel'

                expanded={true}
                editorNode={this.props.streamMessageEditor}

                isPaidUser={this.props.accountStore!.isPaidUser}
                filenamePrefix={'DataChannel ' + (dataChannel.label || dataChannel.channelId)}
                messages={dataChannel.messages}
            />
        </ExpandedContentContainer>;

    }

};