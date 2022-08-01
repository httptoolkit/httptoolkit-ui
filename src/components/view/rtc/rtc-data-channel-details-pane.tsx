import * as _ from 'lodash';
import * as React from 'react';
import { action, observable } from 'mobx';
import { observer, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { AccountStore } from '../../../model/account/account-store';
import { RTCDataChannel } from '../../../model/webrtc/rtc-data-channel';

import { ExpandedPaneContentContainer } from '../view-details-pane';
import { ThemedSelfSizedEditor } from '../../editor/base-editor';
import { RTCDataChannelCard } from './rtc-data-channel-card';

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
            dataChannel,
            streamMessageEditor,
            accountStore
        } = this.props;

        return <ExpandedPaneContentContainer>
            <RTCDataChannelCard
                dataChannel={dataChannel}
                isPaidUser={accountStore!.isPaidUser}
                streamMessageEditor={streamMessageEditor}

                collapsed={false}
                expanded={true}
            />
        </ExpandedPaneContentContainer>;

    }

};