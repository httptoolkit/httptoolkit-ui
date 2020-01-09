import * as React from 'react';
import { observer, inject } from 'mobx-react';
import * as QRCode from 'qrcode.react';

import { styled } from '../../../styles';

import { Interceptor } from '../../../model/interceptors';
import { InterceptionStore } from '../../../model/interception-store';

const ConfigContainer = styled.div`
    user-select: text;

    > p {
        line-height: 1.2;

        &:not(:last-child) {
            margin-bottom: 5px;
        }

        &:not(:first-child) {
            margin-top: 5px;
        }
    }

    > canvas {
        margin: 0 auto;
    }

    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: start;
`;

const Spacer = styled.div`
    flex: 1 1 100%;
`;

function urlSafeBase64(content: string) {
    return Buffer.from(content, 'utf8').toString('base64')
        .replace('+', '-')
        .replace('/', '_');
}

@inject('interceptionStore')
@observer
class AndroidConfig extends React.Component<{
    interceptionStore?: InterceptionStore,
    interceptor: Interceptor,
    activateInterceptor: () => Promise<void>,
    showRequests: () => void,
    closeSelf: () => void
}> {

    render() {
        const {
            certFingerprint,
            serverPort,
            networkAddresses
        } = this.props.interceptionStore!;

        const setupParams ={
            addresses: networkAddresses,
            port: serverPort,
            certFingerprint: certFingerprint!
        };

        const serializedSetupParams = urlSafeBase64(JSON.stringify(setupParams));

        return <ConfigContainer>
            <p>
                Scan the QR code below on your device to install the HTTP Toolkit
                app, and start intercepting HTTP & HTTPS traffic.
            </p>
            <p>
                Don't have a barcode scanner? Install the <a
                    href={
                        `https://play.google.com/store/apps/details?id=tech.httptoolkit.android&referrer=${
                            serializedSetupParams
                        }`
                    }
                    target='_blank'
                    rel='noreferrer noopener'
                >
                    HTTP Toolkit app
                </a> manually instead.
            </p>

            <Spacer />
            <QRCode
                size={150}
                value={
                    `https://android.httptoolkit.tech/connect/?data=${serializedSetupParams}`
                }
            />
            <Spacer />

            <p>
                Once activated, this will send all HTTP & HTTPS traffic to HTTP Toolkit,
                and configure the device to trust its HTTPS certificate by default.
            </p>
            <p>
                This won't work immediately for all apps. Some may need changes to trust HTTP Toolkit for
                HTTPS traffic. <a
                    href="https://httptoolkit.tech/docs/guides/android"
                    target='_blank'
                    rel='noreferrer noopener'
                >
                    See the docs
                </a> for more details.
            </p>
        </ConfigContainer>;
    }

}

export const AndroidCustomUi = {
    columnWidth: 2,
    rowHeight: 2,
    configComponent: AndroidConfig
};