import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';

import { RTCMediaTrack } from '../../../model/webrtc/rtc-media-track';

import { ExpandedPaneContentContainer } from '../view-details-pane';
import { RTCMediaCard } from './rtc-media-card';

@observer
export class RTCMediaDetailsPane extends React.Component<{
    mediaTrack: RTCMediaTrack
}> {

    render() {
        const {
            mediaTrack
        } = this.props;

        return <ExpandedPaneContentContainer>
            <RTCMediaCard
                collapsed={false}
                expanded={true}
                onCollapseToggled={_.noop}

                // Link the key to the track, to ensure selected-message state gets
                // reset when we switch between traffic:
                key={mediaTrack.id}

                mediaTrack={mediaTrack}
            />
        </ExpandedPaneContentContainer>;

    }

};