/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import * as _ from 'lodash';
import * as React from 'react';
import { action, observable } from 'mobx';
import { observer } from 'mobx-react';

import { RTCMediaTrack } from '../../../model/webrtc/rtc-media-track';

import { PaneOuterContainer } from '../view-details-pane';
import { RTCMediaCard } from './rtc-media-card';
import { RTCConnectionHeader } from './rtc-connection-header';

@observer
export class RTCMediaDetailsPane extends React.Component<{
    mediaTrack: RTCMediaTrack,
    navigate: (path: string) => void
}> {

    @observable
    private isConnectionHidden = false;

    @action.bound
    hideConnection() {
        this.isConnectionHidden = true;
    }

    jumpToConnection = () => {
        const { rtcConnection } = this.props.mediaTrack;
        this.props.navigate(`/view/${rtcConnection.id}`);
    }

    render() {
        const {
            mediaTrack
        } = this.props;

        return <PaneOuterContainer>
            { !this.isConnectionHidden &&
                <RTCConnectionHeader
                    connection={mediaTrack.rtcConnection}
                    hideConnection={this.hideConnection}
                    jumpToConnection={this.jumpToConnection}
                />
            }
            <RTCMediaCard
                collapsed={false}
                expanded={true}
                onExpandToggled={this.jumpToConnection}
                onCollapseToggled={undefined} // Hide the collapse button
                ariaLabel='RTC Media Stream Section'

                // Link the key to the track, to ensure selected-message state gets
                // reset when we switch between traffic:
                key={mediaTrack.id}

                mediaTrack={mediaTrack}
            />
        </PaneOuterContainer>;

    }

};