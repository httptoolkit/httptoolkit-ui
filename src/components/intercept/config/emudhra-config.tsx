import * as React from 'react';
import { observable, flow } from 'mobx';
import { inject, observer } from 'mobx-react';

import { ProxyStore } from '../../../model/proxy-store';
import { Interceptor } from '../../../model/interception/interceptors';
import { asError } from '../../../util/error';
import { Content, CopyableMonoValue } from '../../common/text-content';
import { Button } from '../../common/inputs';

@inject('proxyStore')
@observer
export class EmudhraConfig extends React.Component<{
    proxyStore?: ProxyStore;
    interceptor: Interceptor;
    closeSelf: () => void;
    activateInterceptor: () => Promise<{ port: number }>;
    reportStarted: () => void;
    reportSuccess: (options?: { showRequests?: boolean }) => void;
}> {
    @observable port: number | undefined;
    @observable error: string | undefined;

    componentDidMount() {
        this.enable();
    }

    enable = flow(function * (this: EmudhraConfig) {
        this.error = undefined;
        this.props.reportStarted();
        try {
            this.port = yield this.props.proxyStore!.enableExtraHttps('emudhra');
            this.props.reportSuccess({ showRequests: false });
        } catch (error) {
            this.error = asError(error).message;
        }
    }).bind(this);

    render() {
        if (this.error) return <Content>
            <p role="alert">Could not enable eMudhra interception: {this.error}</p>
            <Button onClick={this.enable}>Try again</Button>
        </Content>;

        if (!this.port) return <p>Opening the eMudhra interception port…</p>;

        return <Content style={{ overflowY: 'auto' }}>
            <p>
                Configure your client's HTTP/HTTPS proxy using one of these addresses.
                From another device, use this machine's network IP address.
            </p>
            <ul>
                {['localhost', ...this.props.proxyStore!.externalNetworkAddresses].map(address => <li key={address}>
                    <CopyableMonoValue>http://{address.includes(':') ? `[${address}]` : address}:{this.port}</CopyableMonoValue>
                </li>)}
            </ul>
            <p>
                For devices without proxy settings, route their traffic through this machine
                and forward HTTP/TLS connections to this port, preserving the original hostname.
                This may require DNS overrides, ARP spoofing, or a custom Wi-Fi hotspot with port forwarding.
            </p>
            <p>
                Uses the compromised eMudhra CA signed by AAA Certificate Services.
                The client must already trust this CA. Do not install additional certificates.
            </p>
            <p>
                Your normal proxy keeps using the local CA. This extra port stays open until
                the proxy session ends.
            </p>
        </Content>;
    }
}

export const EmudhraCustomUi = {
    rowHeight: 1,
    columnWidth: 4,
    configComponent: EmudhraConfig
};
