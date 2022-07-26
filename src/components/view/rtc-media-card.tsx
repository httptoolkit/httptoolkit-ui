import * as _ from 'lodash';
import * as React from 'react';
import { computed } from 'mobx';
import { Observer, observer } from 'mobx-react';
import { ParentSize } from '@vx/responsive';

import { styled } from '../../styles';

import { RTCMediaTrack } from '../../model/webrtc/rtc-media-track';

import {
    CollapsibleCard,
    CollapsibleCardHeading,
    CollapsibleCardProps
} from '../common/card';
import { Pill } from '../common/pill';
import {
    SendReceiveGraph,
    SentDataColour,
    ReceivedDataColour
} from '../common/send-recieve-graph';

import { getReadableSize } from '../../model/events/bodies';

export type RTCMediaCardProps = Omit<CollapsibleCardProps, 'children'> & {
    mediaTrack: RTCMediaTrack
};

export const RTCMediaCard = observer((props: RTCMediaCardProps) => {
    const { mediaTrack } = props;
    return <RTCMediaCardCard {...props}>
        <header>
            <Pill color={SentDataColour}>
                { getReadableSize(props.mediaTrack.totalBytesSent) } sent
            </Pill>
            <Pill color={ReceivedDataColour}>
                { getReadableSize(props.mediaTrack.totalBytesReceived) } received
            </Pill>
            <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
                RTC Media
            </CollapsibleCardHeading>
        </header>

        <StatsGraphWrapper>
            <RTCMediaStats mediaTrack={mediaTrack} />
        </StatsGraphWrapper>
    </RTCMediaCardCard>;
});

const RTCMediaCardCard = styled(CollapsibleCard)`
    display: flex;
    flex-direction: column;
`;

const StatsGraphWrapper = styled.div`
    margin: 0 -20px -20px -20px;
    border-top: solid 1px ${p => p.theme.containerBorder};
    background-color: ${p => p.theme.highlightBackground};

    position: relative;
    flex-grow: 1;

    min-height: 400px;
`;

@observer
class RTCMediaStats extends React.Component<{ mediaTrack: RTCMediaTrack }> {

    @computed
    get graphData(): Array<{ sent: number, received: number }> {
        const { stats } = this.props.mediaTrack;
        return _.map(stats, (stat) => ({ sent: stat.sentDelta, received: stat.receivedDelta }));
    }

    render() {
        return <ParentSize>{ parent =>
            <Observer>{() =>
                <SendReceiveGraph
                    width={parent.width}
                    height={parent.height}
                    graphPaddingPx={10}
                    data={this.graphData}
                />
            }</Observer>
        }</ParentSize>;
    }
}