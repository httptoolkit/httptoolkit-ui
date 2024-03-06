import * as _ from 'lodash';
import * as React from 'react';
import { when } from 'mobx';
import { observer, inject } from 'mobx-react';
import * as QRCode from 'qrcode.react';
import {
    matchers,
    completionCheckers
} from 'mockttp';

import { styled } from '../../../styles';
import { stringToBuffer } from '../../../util/buffer';
import { logError } from '../../../errors';

import { Interceptor } from '../../../model/interception/interceptors';
import { ProxyStore } from '../../../model/proxy-store';
import { EventsStore } from '../../../model/events/events-store';

import {
    MethodMatchers,
    StaticResponseHandler
} from '../../../model/rules/definitions/http-rule-definitions';
import { RulesStore } from '../../../model/rules/rules-store';
import { RulePriority } from '../../../model/rules/rules';

const ConfigContainer = styled.div`
    user-select: text;

    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: start;

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
        /* Without white padding, the QR code sometimes isn't scannable */
        padding: 5px;
        background-color: #fff;
    }

    a[href] {
        color: ${p => p.theme.linkColor};

        &:visited {
            color: ${p => p.theme.visitedLinkColor};
        }
    }
`;

const Spacer = styled.div`
    flex: 1 1 100%;
`;

function urlSafeBase64(content: string) {
    return stringToBuffer(content)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function getConfigRequestIds(eventsStore: EventsStore) {
    return eventsStore.exchanges.filter((exchange) =>
        exchange.request.url === 'http://android.httptoolkit.tech/config'
    ).map(e => e.id);
}

export function setUpAndroidCertificateRule(
    certContent: string,
    rulesStore: RulesStore,
    eventsStore: EventsStore,
    onNextConfigRequest: () => void
) {
    rulesStore.ensureRuleExists({
        id: 'default-android-certificate',
        type: 'http',
        activated: true,
        priority: RulePriority.OVERRIDE,
        matchers: [
            new MethodMatchers.GET(),
            new matchers.SimplePathMatcher(
                "http://android.httptoolkit.tech/config"
            )
        ],
        completionChecker: new completionCheckers.Always(),
        handler: new StaticResponseHandler(200, undefined, JSON.stringify({
            certificate: certContent
        }), {
            'content-type': 'application/json'
        })
    });

    // When the next Android config request comes in:
    const previousConfigRequestIds = getConfigRequestIds(eventsStore);
    when(() =>
        _.difference(
            getConfigRequestIds(eventsStore),
            previousConfigRequestIds
        ).length > 0
    ).then(() => {
        // In effect, we treat this as 'success' for Android. That's not quite
        // true: we just know the device is running the app and can connect to
        // us, but cert setup or VPN activation could still fail in-app anyway!
        onNextConfigRequest();
    });
}

@inject('proxyStore')
@inject('rulesStore')
@inject('eventsStore')
@observer
class AndroidConfig extends React.Component<{
    proxyStore?: ProxyStore,
    rulesStore?: RulesStore,
    eventsStore?: EventsStore,

    reportStarted: () => void,
    reportSuccess: (options?: { showRequests?: boolean }) => void,
    closeSelf: () => void

    // Not used, but required for types:
    interceptor: Interceptor,
    activateInterceptor: () => Promise<void>
}> {

    async componentDidMount() {
        const rulesStore = this.props.rulesStore!;
        const eventsStore = this.props.eventsStore!;
        const proxyStore = this.props.proxyStore!;

        const { reportStarted, reportSuccess } = this.props;

        // Just in case the network addresses have changed:
        proxyStore.refreshNetworkAddresses().then(() => {
            // This should never happen, but plausibly could in some edge cases, in which case we need
            // to clearly tell the user what's going on here:
            if (proxyStore.externalNetworkAddresses.length === 0) {
                alert(
                    "Cannot activate Android interception as no network addresses could be detected." +
                    "\n\n" +
                    "Please open an issue at github.com/httptoolkit/httptoolkit"
                );
                logError("Android QR activation failed - no network addresses");
                this.props.closeSelf();
            }
        });

        setUpAndroidCertificateRule(
            proxyStore!.certContent!,
            rulesStore,
            eventsStore,
            // Jump to requests only the first time, so it's not too inconvenient
            // if you want to connect many devices at the same time:
            getConfigRequestIds(eventsStore).length === 0
                ? reportSuccess
                : () => reportSuccess({ showRequests: false })
        );

        // We consider activate attempted once you show the QR code
        reportStarted();
    }

    render() {
        const {
            certFingerprint,
            httpProxyPort,
            externalNetworkAddresses
        } = this.props.proxyStore!;

        const setupParams ={
            addresses: externalNetworkAddresses,
            port: httpProxyPort,
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
                        `https://play.google.com/store/apps/details?id=tech.httptoolkit.android.v1&referrer=${
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
                size={160}
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
                <strong>This won't work immediately for all apps.</strong> Some may need changes
                to trust HTTP Toolkit for HTTPS traffic. <a
                    href="https://httptoolkit.com/docs/guides/android"
                    target='_blank'
                    rel='noreferrer noopener'
                >
                    See the docs
                </a> for more details.
            </p>
        </ConfigContainer>;
    }

}

export const AndroidDeviceCustomUi = {
    columnWidth: 2,
    rowHeight: 2,
    configComponent: AndroidConfig
};