/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import * as _ from 'lodash';
import * as React from 'react';
import { computed } from 'mobx';
import { Observer, observer } from 'mobx-react';
import { ParentSize } from '@vx/responsive';

import { styled } from '../../../styles';

import { getReadableSize } from '../../../util/buffer';
import { RTCMediaTrack } from '../../../model/webrtc/rtc-media-track';

import {
    CollapsibleCard,
    CollapsibleCardHeading
} from '../../common/card';
import { Pill } from '../../common/pill';
import {
    SendReceiveGraph,
    SentDataColour,
    ReceivedDataColour
} from '../../common/send-recieve-graph';
import { CollapsingButtons } from '../../common/collapsing-buttons';
import { ExpandShrinkButton } from '../../common/expand-shrink-button';

export type RTCMediaCardProps = {
    mediaTrack: RTCMediaTrack,

    collapsed: boolean,
    expanded: boolean,
    onExpandToggled: () => void,
    onCollapseToggled?: () => void,
    ariaLabel: string;
};

export const RTCMediaCard = observer((props: RTCMediaCardProps) => {
    const { mediaTrack, ...cardProps } = props;

    return <CollapsibleCard {...cardProps}>
        <header>
            <CollapsingButtons>
                <ExpandShrinkButton
                    expanded={cardProps.expanded}
                    onClick={cardProps.onExpandToggled}
                />
            </CollapsingButtons>

            <Pill color={SentDataColour}>
                { getReadableSize(mediaTrack.totalBytesSent) } sent
            </Pill>
            <Pill color={ReceivedDataColour}>
                { getReadableSize(mediaTrack.totalBytesReceived) } received
            </Pill>
            <CollapsibleCardHeading onCollapseToggled={cardProps.onCollapseToggled}>
                RTC { mediaTrack.type }
            </CollapsibleCardHeading>
        </header>

        <StatsGraphWrapper>
            <RTCMediaStats mediaTrack={mediaTrack} />
        </StatsGraphWrapper>
    </CollapsibleCard>;
});

const StatsGraphWrapper = styled.div`
    margin: 0 -20px -20px -20px;
    border-top: solid 1px ${p => p.theme.containerBorder};
    background-color: ${p => p.theme.highlightBackground};

    position: relative;
    flex-grow: 1;

    min-height: 400px;

    /* Fix the ParentSize measuring div to match our size exactly. */
    > div {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
    }
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