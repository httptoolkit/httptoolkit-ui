/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import * as _ from 'lodash';
import * as React from 'react';
import { action, observable } from 'mobx';
import { observer, inject } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { AccountStore } from '../../../model/account/account-store';
import { RTCDataChannel } from '../../../model/webrtc/rtc-data-channel';

import { PaneOuterContainer } from '../view-details-pane';
import { SelfSizedEditor } from '../../editor/base-editor';
import { RTCDataChannelCard } from './rtc-data-channel-card';
import { RTCConnectionHeader } from './rtc-connection-header';

@inject('accountStore')
@observer
export class RTCDataChannelDetailsPane extends React.Component<{
    dataChannel: RTCDataChannel,

    streamMessageEditor: portals.HtmlPortalNode<typeof SelfSizedEditor>,
    navigate: (path: string) => void,

    // Injected:
    accountStore?: AccountStore
}> {

    @observable
    private isConnectionHidden = false;

    @action.bound
    hideConnection() {
        this.isConnectionHidden = true;
    }

    jumpToConnection = () => {
        const { rtcConnection } = this.props.dataChannel;
        this.props.navigate(`/view/${rtcConnection.id}`);
    }

    render() {
        const {
            dataChannel,
            streamMessageEditor,
            accountStore
        } = this.props;

        return <PaneOuterContainer>
            { !this.isConnectionHidden &&
                <RTCConnectionHeader
                    connection={dataChannel.rtcConnection}
                    hideConnection={this.hideConnection}
                    jumpToConnection={this.jumpToConnection}
                />
            }
            <RTCDataChannelCard
                dataChannel={dataChannel}
                isPaidUser={accountStore!.isPaidUser}
                streamMessageEditor={streamMessageEditor}

                collapsed={false}
                expanded={true}
                onExpandToggled={this.jumpToConnection}
                onCollapseToggled={undefined} // Hide the collapse button
                ariaLabel='RTC Data Messages Section'
            />
        </PaneOuterContainer>;

    }

};