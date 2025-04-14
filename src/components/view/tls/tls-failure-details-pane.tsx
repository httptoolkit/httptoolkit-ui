import * as _ from 'lodash';
import * as React from 'react';

import { styled } from '../../../styles';
import { Icon, SourceIcons } from '../../../icons';

import { getReadableIP } from '../../../model/network';
import { FailedTlsConnection } from '../../../model/tls/failed-tls-connection';

import { MediumCard } from '../../common/card';
import { ContentLabelBlock, Content, CopyableMonoValue } from '../../common/text-content';
import { PaneScrollContainer } from '../view-details-pane';

const AndroidIcon = styled(Icon).attrs({
    icon: SourceIcons.Android.icon
})`
    float: left;
    margin-right: 10px;
    margin-top: 3px;
    color: ${SourceIcons.Android.color};
`;

export class TlsFailureDetailsPane extends React.Component<{
    failure: FailedTlsConnection,
    certPath: string
}> {
    render() {
        const { failure, certPath } = this.props;

        // This _should_ always be available, but due to some awkward & unclear Node issues it isn't,
        // so we need to be a little careful here.
        const sourceDetailParts = failure.remoteIpAddress
            ? getReadableIP(failure.remoteIpAddress).split(' ')
            : undefined;
        const sourceIp = sourceDetailParts?.[0];
        const sourceDetails = sourceDetailParts?.slice(1).join(' ');

        return <PaneScrollContainer>
            <MediumCard>
                <header>
                    <h1>Failed HTTPS Request</h1>
                </header>

                <ContentLabelBlock>Details</ContentLabelBlock>
                <Content>
                    <p>{
                        ({
                            'closed': <>
                                This connection was aborted and closed before any HTTP request was sent.
                            </>,
                            'reset': <>
                                This connection was aborted and reset before any HTTP request was sent.
                            </>,
                            'cert-rejected': <>
                                This connection was aborted, before any HTTP request was sent,
                                because the client did not trust the HTTP Toolkit certificate.
                            </>,
                            'no-shared-cipher': <>
                                This connection was aborted, before any HTTP request was sent,
                                because the client failed to agree on a TLS configuration.
                            </>,
                            'unknown': <>
                                This connection was aborted, before any HTTP request was sent,
                                due to a TLS error.
                            </>,
                        } as _.Dictionary<JSX.Element>)[failure.failureCause]
                    }</p>
                    { sourceIp && sourceDetails && <p>
                        The request was sent by <CopyableMonoValue>
                            { sourceIp }
                        </CopyableMonoValue> { sourceDetails }.
                    </p> }
                </Content>

                <ContentLabelBlock>Cause</ContentLabelBlock>
                <Content>{
                    failure.failureCause === 'cert-rejected'
                        ? <p>
                            This means that the client hasn't yet been fully configured
                            to work with HTTP Toolkit. It has the proxy settings,
                            but it doesn't trust our certificate authority (CA), so we
                            can't intercept its HTTPS traffic.
                        </p>
                    : failure.failureCause === 'no-shared-cipher'
                        ? <>
                            <p>
                                This usually means that the client hasn't yet been 100% configured
                                to work with HTTP Toolkit, although it's also possible that
                                it has an unusual TLS setup.
                            </p>
                            <p>
                                The former case is much more likely. That would mean that the
                                client has the right proxy settings, but doesn't trust our
                                certificate authority (CA), so we can't imitate HTTPS sites and
                                we can't collect or see its HTTPS traffic.
                            </p>
                        </>
                    : <>
                        <p>This could be caused by a few things:</p>
                        <ul>
                            <li>The client might no longer want to make the request</li>
                            <li>The client might have connection issues</li>
                            <li>The client might not trust our HTTPS certificate</li>
                        </ul>
                    </>
                }</Content>
                <ContentLabelBlock>Solutions</ContentLabelBlock>
                <Content>
                    <p>
                        {
                            failure.failureCause === 'cert-rejected'
                                ? <>
                                    To resolve this, you need to configure the client to trust
                                    your HTTP Toolkit CA.
                                </>
                            : failure.failureCause === 'no-shared-cipher'
                                ? <>
                                    You probably need to ensure the client is configured to trust the
                                    HTTP Toolkit CA.
                                </>
                            : <>
                                In the first two cases, this is not related to HTTP Toolkit.
                                In the third case, you need to configure the client to trust your
                                HTTP Toolkit CA.
                            </>
                        }
                    </p>
                    <p>
                        How you do this depends on the specific client. Opening the certificate file
                        on the device may prompt you to trust it device-wide, or you may need a
                        specific option for the HTTP library or tool that's being used.
                    </p>

                    <p>
                        Your HTTP Toolkit certificate is stored on your machine at <CopyableMonoValue>
                            { certPath }
                        </CopyableMonoValue>
                    </p>
                    <AndroidIcon />
                    <p>
                        <strong>For Android devices</strong>, modern apps will not
                        trust your installed CA certificates by default. For apps targeting
                        API level 24+, the app must opt in to trusting user CA certificates, or
                        you need to inject a system certificate (only possible on rooted devices
                        and emulators).
                    </p>
                    <p>
                        Trusting user CA certificates in your own app is a small & simple
                        configuration change, see <a
                            href="https://httptoolkit.com/docs/guides/android#intercepting-traffic-from-your-own-android-app"
                        >the HTTP Toolkit docs</a> for more details. Alternatively HTTP Toolkit
                        can inject the system certificate for you automatically, on devices that
                        support this, by connecting the device with ADB and using the "Android
                        device via ADB" interception option.
                    </p>
                    <p>
                        Take a look at the <a href="https://httptoolkit.com/docs/guides/android/">
                            Android interception guide
                        </a> for more information.
                    </p>
                </Content>
            </MediumCard>
        </PaneScrollContainer>;
    }
}