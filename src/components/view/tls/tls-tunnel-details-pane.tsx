import * as _ from 'lodash';
import * as React from 'react';

import { getReadableIP } from '../../../model/network';
import { TlsTunnel } from '../../../model/tls/tls-tunnel';

import { MediumCard } from '../../common/card';
import { ContentLabelBlock, Content, CopyableMonoValue } from '../../common/text-content';
import { PaneScrollContainer } from '../view-details-pane';

export class TlsTunnelDetailsPane extends React.Component<{
    tunnel: TlsTunnel
}> {
    render() {
        const { tunnel } = this.props;

        const sourceDetailParts = getReadableIP(tunnel.remoteIpAddress).split(' ');
        const sourceIp = sourceDetailParts[0];
        const sourceDetails = sourceDetailParts.slice(1).join(' ');

        return <PaneScrollContainer>
            <MediumCard>
                <header>
                    <h1>TLS Tunnel</h1>
                </header>

                <ContentLabelBlock>Details</ContentLabelBlock>
                <Content>
                    <p>
                        This TLS connection was not intercepted by HTTP Toolkit, as it matched
                        a hostname that is configured for TLS passthrough in your settings.
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
        </PaneScrollContainer>;
    }
}