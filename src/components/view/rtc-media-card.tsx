import * as _ from 'lodash';
import * as React from 'react';
import { computed } from 'mobx';
import { observer } from 'mobx-react';

import { RTCMediaTrack } from '../../model/webrtc/rtc-media-track';

import {
    CollapsibleCard,
    CollapsibleCardHeading,
    CollapsibleCardProps
} from '../common/card';
import { SendReceiveGraph } from '../common/send-recieve-graph';

export type RTCMediaCardProps = Omit<CollapsibleCardProps, 'children'> & {
    mediaTrack: RTCMediaTrack
};

export const RTCMediaCard = observer((props: RTCMediaCardProps) => {
    const { mediaTrack } = props;
    return <CollapsibleCard {...props}>
        <header>
            <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
                Request
            </CollapsibleCardHeading>
        </header>

        <RTCMediaStats mediaTrack={mediaTrack} />
    </CollapsibleCard>;
});

@observer
class RTCMediaStats extends React.Component<{ mediaTrack: RTCMediaTrack }> {

    @computed
    get graphData(): Array<{ sent: number, received: number }> {
        const { stats } = this.props.mediaTrack;
        return _.map(stats, (stat) => ({ sent: stat.sentDelta, received: stat.receivedDelta }));
    }

    render() {
        return <SendReceiveGraph
            width={400}
            height={200}
            graphPaddingPx={10}
            data={this.graphData}
        />;
    }
}