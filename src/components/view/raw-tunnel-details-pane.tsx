import * as _ from 'lodash';
import * as React from 'react';
import * as portals from 'react-reverse-portal';
import { inject, observer } from 'mobx-react';

import { getReadableIP } from '../../model/network';
import { RawTunnel } from '../../model/raw-tunnel';
import { UiStore } from '../../model/ui/ui-store';

import { formatDuration } from '../../util/text';
import { getReadableSize } from '../../util/buffer';

import { MediumCard } from '../common/card';

import { ContentLabelBlock, Content, CopyableMonoValue } from '../common/text-content';
import { PaneScrollContainer } from './view-details-pane';
import { StreamMessageListCard } from './stream-message-list-card';
import { SelfSizedEditor } from '../editor/base-editor';

@inject('uiStore')
@observer
export class RawTunnelDetailsPane extends React.Component<{
    tunnel: RawTunnel,
    streamMessageEditor: portals.HtmlPortalNode<typeof SelfSizedEditor>,
    isPaidUser: boolean,
    uiStore?: UiStore
}> {
    render() {
        const { tunnel } = this.props;

        const sourceDetailParts = getReadableIP(tunnel.remoteIpAddress).split(' ');
        const sourceIp = sourceDetailParts[0];
        const sourceDetails = sourceDetailParts.slice(1).join(' ');

        const packetCardProps = this.props.uiStore!.viewCardProps['rawTunnelPackets'];

        const packetsListCard = <StreamMessageListCard
            isPaidUser={this.props.isPaidUser}
            {...packetCardProps}

            streamId={tunnel.id}
            cardHeading='Raw Data'
            streamLabel={tunnel.upstreamHostname}
            editorNode={this.props.streamMessageEditor}
            filenamePrefix={`Raw Tunnel ${tunnel.upstreamHostname} ${tunnel.upstreamPort} ${tunnel.id}`}
            messages={tunnel.packets}
        />;

        if (packetCardProps.expanded) return packetsListCard;

        return <PaneScrollContainer>
            <MediumCard>
                <header>
                    <h1>Raw Tunnel</h1>
                </header>

                <ContentLabelBlock>Details</ContentLabelBlock>
                <Content>
                    <p>
                        This connection was not intercepted by HTTP Toolkit, as it contains
                        an unrecognized non-HTTP protocol, so was tunnelled directly to its destination.
                    </p>
                </Content>
                <Content>
                    <p>
                        The connection was made from <CopyableMonoValue>{
                            sourceIp
                        }:{
                            tunnel.remotePort
                        }</CopyableMonoValue> { sourceDetails } to <CopyableMonoValue>{
                            tunnel.upstreamHostname
                        }:{
                            tunnel.upstreamPort
                        }</CopyableMonoValue>.
                    </p>
                </Content>
            </MediumCard>
            { packetsListCard }
            {
                !tunnel.isOpen() &&
                <MediumCard>
                    <header>
                        <h1>Connection Closed</h1>
                    </header>
                    <Content>
                        This tunnel was closed {
                            tunnel.timingEvents.disconnectTimestamp
                            ? <>after {formatDuration(
                                tunnel.timingEvents.disconnectTimestamp - tunnel.timingEvents.connectTimestamp
                            )}</> : <></>
                        }.
                    </Content>
                </MediumCard>
            }
        </PaneScrollContainer>;
    }
}