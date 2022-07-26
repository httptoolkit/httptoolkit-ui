import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';

import { styled } from '../../../styles';

import { RTCMediaTrack } from '../../../model/webrtc/rtc-media-track';
import { RTCMediaCard } from './rtc-media-card';

const ExpandedContentContainer = styled.div`
    padding: 0;
    transition: padding 0.1s;

    box-sizing: border-box;
    height: 100%;
    width: 100%;

    display: flex;
    flex-direction: column;
`;

@observer
export class RTCMediaDetailsPane extends React.Component<{
    mediaTrack: RTCMediaTrack
}> {

    render() {
        const {
            mediaTrack
        } = this.props;

        return <ExpandedContentContainer>
            <RTCMediaCard
                collapsed={false}
                expanded={true}
                onCollapseToggled={_.noop}

                // Link the key to the track, to ensure selected-message state gets
                // reset when we switch between traffic:
                key={mediaTrack.id}

                mediaTrack={mediaTrack}
            />
        </ExpandedContentContainer>;

    }

};