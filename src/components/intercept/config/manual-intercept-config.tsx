import * as React from 'react';
import { observer, inject, Observer } from 'mobx-react';

import { styled } from '../../../styles';
import { Icon } from '../../../icons';

import { ProxyStore } from '../../../model/proxy-store';
import { saveFile } from '../../../util/ui';

import { StatusPill } from '../intercept-option';
import { PillButton } from '../../common/pill';
import { CopyableMonoValue } from '../../common/text-content';

const InstructionsContainer = styled.div`
    display: flex;
    flex-direction: row;
    user-select: text;
    margin-top: 5px;
`;

const InstructionsStep = styled.div`
    flex: 1 1 0;

    &:not(:last-child) {
        margin-right: 40px;
    }

    > h2 {
        font-size: ${p => p.theme.headingSize};
        margin-bottom: 10px;
    }

    > ol {
        list-style: decimal;

        > li {
            margin-left: 20px;
            margin-bottom: 10px;
        }
    }

    > p {
        line-height: 1.3;

        &:not(:last-child) {
            margin-bottom: 10px;
        }
    }

    strong {
        font-weight: bold;
    }

    a[href] {
        color: ${p => p.theme.linkColor};

        &:visited {
            color: ${p => p.theme.visitedLinkColor};
        }
    }
`;

const Nowrap = styled.span`
    white-space: nowrap;
`;

const ManualInterceptPill = inject('proxyStore')(observer(
    (p: {
        proxyStore?: ProxyStore,
        children?: React.ReactNode
    }) =>
        <StatusPill color='#4caf7d'>
            Proxy port: { p.proxyStore!.httpProxyPort }
        </StatusPill>
));

const ExportCertificateButton = styled((p: { certContent: string, className?: string }) =>
    <PillButton
        className={p.className}
        onClick={() => saveFile(
            'http-toolkit-ca-certificate.crt',
            'application/x-x509-ca-cert',
            p.certContent
        )}
    >
        <Icon icon={['fas', 'download']} /> Export CA certificate
    </PillButton>
)`
    margin: 0 0 10px 0;
`;

const ManualInterceptConfig = inject('proxyStore')(
    (p: {
        proxyStore?: ProxyStore,
        children?: React.ReactNode,
        reportStarted: () => void
    }) => {
        // Report activation when first opened
        React.useEffect(() => p.reportStarted(), []);

        const { httpProxyPort, certPath, certContent } = p.proxyStore!;

        return <Observer>{() =>
            <InstructionsContainer>
                <InstructionsStep>
                    <p>To intercept traffic you need to:</p>
                    <ol>
                        <li><strong>send your traffic via the HTTP Toolkit proxy</strong></li>
                        <li><strong>trust the certificate authority</strong> (if using HTTPS) </li>
                    </ol>
                    <p>
                        The steps to do this manually depend
                        on the client, but all the details
                        you'll need are shown here.
                    </p>
                    <p>
                        Want your client to be supported automatically? <Nowrap>
                            <a href='https://github.com/httptoolkit/httptoolkit/issues/new'>
                                Send some feedback
                            </a>
                        </Nowrap>.
                    </p>
                </InstructionsStep>

                <InstructionsStep>
                    <h2>1. Send traffic via HTTP Toolkit</h2>
                    <p>
                        To intercept an HTTP client on this machine, configure it to send traffic via{' '}
                        <CopyableMonoValue>http://localhost:{httpProxyPort}</CopyableMonoValue>.
                    </p>
                    <p>
                        Most tools can be configured to do so by using the above address as an HTTP or
                        HTTPS proxy.
                    </p>
                    <p>
                        In other cases, it's also possible to forcibly reroute traffic
                        using networking tools like iptables.
                    </p>
                    <p>
                        Remote clients (e.g. phones) will need to use the IP address of this machine, not
                        localhost.
                    </p>
                </InstructionsStep>

                <InstructionsStep>
                    <h2>2. Trust the certificate authority</h2>
                    <p><em>Only required to intercept traffic that uses HTTPS</em></p>
                    <p>
                        HTTP Toolkit has generated a certificate authority (CA) on your machine. All
                        intercepted HTTPS uses certificates from this CA.
                    </p>
                    { certContent // Not defined in some older server versions
                        ? <ExportCertificateButton certContent={certContent} />
                        : <p>
                            The certificate is stored on your machine at <CopyableMonoValue>{
                                certPath
                            }</CopyableMonoValue>.
                        </p>
                    }
                    <p>
                        To intercept HTTPS traffic you need to configure your HTTP client to
                        trust this certificate as a certificate authority, or to temporarily
                        disable certificate checks entirely.
                    </p>
                </InstructionsStep>
            </InstructionsContainer>
        }</Observer>;
    }
);

export const ManualInterceptCustomUi = {
    rowHeight: 1,
    columnWidth: 4,
    configComponent: ManualInterceptConfig,
    customPill: ManualInterceptPill
};