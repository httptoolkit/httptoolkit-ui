import * as _ from 'lodash';
import * as React from 'react';
import * as portals from 'react-reverse-portal';

import { getReadableIP } from '../../model/network';
import { RawTunnel } from '../../model/raw-tunnel';

import { MediumCard } from '../common/card';
import { ContentLabelBlock, Content, CopyableMonoValue } from '../common/text-content';
import { PaneScrollContainer } from './view-details-pane';
import { StreamMessageListCard } from './stream-message-list-card';
import { SelfSizedEditor } from '../editor/base-editor';

export class RawTunnelDetailsPane extends React.Component<{
    tunnel: RawTunnel,
    streamMessageEditor: portals.HtmlPortalNode<typeof SelfSizedEditor>,
    isPaidUser: boolean
}> {
    render() {
        const { tunnel } = this.props;

        const sourceDetailParts = getReadableIP(tunnel.remoteIpAddress).split(' ');
        const sourceIp = sourceDetailParts[0];
        const sourceDetails = sourceDetailParts.slice(1).join(' ');

        return <PaneScrollContainer>
            <MediumCard>
                <header>
                    <h1>Raw Tunnel</h1>
                </header>

                <ContentLabelBlock>Details</ContentLabelBlock>
                <Content>
                    <p>
                        This connection was not intercepted by HTTP Toolkit, as it contains
                        an unrecognized (non-HTTP) protocol.
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
            <StreamMessageListCard
                isPaidUser={this.props.isPaidUser}
                ariaLabel='Raw tunnel data'

                collapsed={false}
                expanded={true}
                onExpandToggled={() => {}}
                onCollapseToggled={() => {}}

                streamId={tunnel.id}
                cardHeading='Raw Data'
                streamLabel={tunnel.upstreamHostname}
                editorNode={this.props.streamMessageEditor}
                filenamePrefix={`Raw Tunnel ${tunnel.upstreamHostname} ${tunnel.id}`}
                messages={tunnel.packets}
            />

        </PaneScrollContainer>;
    }
}