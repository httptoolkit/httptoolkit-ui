import * as _ from 'lodash';
import {
    observable,
    action,
    flow,
    computed,
    observe,
    runInAction,
} from 'mobx';

import {
    PluggableAdmin,
    MockttpPluggableAdmin,
    ProxySetting,
    RequestRuleData,
    WebSocketRuleData,
    MockttpHttpsOptions
} from 'mockttp';
import * as MockRTC from 'mockrtc';

import {
    InputHTTPEvent,
    InputRTCEvent,
    PortRange,
} from '../types';
import {
    getConfig,
    announceServerReady,
    getNetworkInterfaces,
    NetworkInterfaces,
} from '../services/server-api';
import { AccountStore } from './account/account-store';

import { delay } from '../util/promise';
import { logError } from '../errors';
import { lazyObservablePromise } from '../util/observable';
import { persist, hydrate } from '../util/mobx-persist/persist';
import { isValidPort } from './network';
import { serverVersion } from '../services/service-versions';

type HtkAdminClient =
    // WebRTC is only supported for new servers:
    | PluggableAdmin.AdminClient<{ http: MockttpPluggableAdmin.MockttpAdminPlugin, webrtc: MockRTC.MockRTCAdminPlugin }>
    | PluggableAdmin.AdminClient<{ http: MockttpPluggableAdmin.MockttpAdminPlugin }>;

// Start the server, with slowly decreasing retry frequency (up to a limit).
// Note that this never fails - any timeout to this process needs to happen elsewhere.
function startServer(
    adminClient: HtkAdminClient,
    config: Parameters<HtkAdminClient['start']>[0],
    maxDelay = 500,
    delayMs = 200
): Promise<void> {
    return adminClient.start(config as any).catch((e) => {
        console.log('Server initialization failed', e);

        if (e.response) {
            // Server is listening, but failed to start as requested.
            // This generally means that some of our config is bad.

            if (e.message?.includes('unrecognized plugin: webrtc')) {
                // We have webrtc enabled, and the server is new enough to recognize plugins and try to
                // start them, but too old to actually support the WebRTC plugin. Skip that entirely then:
                config = {
                    ...config,
                    webrtc: undefined
                };
            } else {
                // Some other error - probably means that the HTTP port is in use.
                // Drop the port config and try again:
                config = {
                    ...config,
                    http: {
                        ...config.http,
                        port: undefined
                    }
                }
            }

            // Retry with our updated config after the tiniest possible delay:
            return delay(100).then(() =>
                startServer(adminClient, config, maxDelay, delayMs)
            );
        }

        // For anything else (unknown errors, or more likely server not listening yet),
        // wait briefly and then retry the same config:
        return delay(Math.min(delayMs, maxDelay)).then(() =>
            startServer(adminClient, config, maxDelay, delayMs * 1.2)
        );
    }) as Promise<void>;
}

export function isValidPortConfiguration(portConfig: PortRange | undefined) {
    return portConfig === undefined || (
        portConfig.endPort >= portConfig.startPort &&
        isValidPort(portConfig.startPort) &&
        isValidPort(portConfig.endPort)
    );
}

export class ProxyStore {

    constructor(
        private readonly accountStore: AccountStore
    ) { }

    @observable.ref
    private adminClient!: HtkAdminClient // Definitely set *after* initialization

    private mockttpRequestBuilder!: MockttpPluggableAdmin.MockttpAdminRequestBuilder;
    private mockRTCRequestBuilder = new MockRTC.MockRTCAdminRequestBuilder();

    @observable
    // !-asserted, because it's definitely set *after initialized*
    certPath!: string;

    @observable
    certContent: string | undefined;

    @observable
    certFingerprint: string | undefined;

    @observable
    externalNetworkAddresses: string[] = [];

    @observable
    systemProxyConfig: ProxySetting | undefined;

    @observable
    dnsServers: string[] = [];

    @observable
    ruleParameterKeys: string[] = [];

    @observable
    serverVersion!: string; // Definitely set *after* initialization

    readonly initialized = lazyObservablePromise(async () => {
        await this.accountStore.initialized;

        await this.loadSettings();
        await this.startIntercepting();
        this.serverVersion = await serverVersion;
        console.log(`Proxy store initialized (server version ${this.serverVersion})`);
    });

    private async loadSettings() {
        const { accountStore } = this;
        // Every time the user account data is updated from the server, consider resetting
        // paid settings to the free defaults. This ensures that they're reset on
        // logout & subscription expiration (even if that happened while the app was
        // closed), but don't get reset when the app starts with stale account data.
        observe(accountStore, 'accountDataLastUpdated', () => {
            if (!accountStore.isPaidUser) {
                this.setPortConfig(undefined);
                this.http2Enabled = 'fallback';
                this.tlsPassthroughConfig = [];
            }
        });

        // Load all persisted settings from storage
        await hydrate({
            key: 'server-store',
            store: this
        });

        console.log('Proxy settings loaded');
    }

    private startIntercepting = flow(function* (this: ProxyStore) {
        this.adminClient = new PluggableAdmin.AdminClient<{
            http: any,
            webrtc: any
        }>({
            adminServerUrl: 'http://127.0.0.1:45456'
        });

        this._http2CurrentlyEnabled = this.http2Enabled;
        this._currentTlsPassthroughConfig = _.cloneDeep(this.tlsPassthroughConfig);

        this.monitorRemoteClientConnection(this.adminClient);

        yield startServer(this.adminClient, {
            http: {
                options: {
                    cors: false,
                    suggestChanges: false,
                    // User configurable settings:
                    http2: this._http2CurrentlyEnabled,
                    https: {
                        tlsPassthrough: this._currentTlsPassthroughConfig
                    } as MockttpHttpsOptions // Cert/Key options are set by the server
                },
                port: this.portConfig
            },
            webrtc: {}
        });

        this.mockttpRequestBuilder = new MockttpPluggableAdmin.MockttpAdminRequestBuilder(
            this.adminClient.schema
        );

        announceServerReady();
        console.log('Server started');

        yield getConfig(this.httpProxyPort).then((config) => {
            this.certPath = config.certificatePath;
            this.certContent = config.certificateContent;
            this.certFingerprint = config.certificateFingerprint;
            this.setNetworkAddresses(config.networkInterfaces);
            this.systemProxyConfig = config.systemProxy;
            this.dnsServers = config.dnsServers;
            this.ruleParameterKeys = config.ruleParameterKeys;
            console.log('Config loaded');
        });

        // Everything seems to agree that here we're 'done'
        console.log(`Server started on port ${this.httpProxyPort}`);

        window.addEventListener('beforeunload', () => {
            this.adminClient.stop().catch(() => { });
        });
    });

    private monitorRemoteClientConnection(client: PluggableAdmin.AdminClient<{}>) {
        client.on('admin-client:stream-error', (err) => {
            console.log('Admin client stream error');
            logError(err.message ? err : new Error('Client stream error'), { cause: err });
        });
        client.on('admin-client:subscription-error', (err) => {
            console.log('Admin client subscription error');
            logError(err.message ? err : new Error('Client subscription error'), { cause: err });
        });
        client.on('admin-client:stream-reconnect-failed', (err) => {
            logError(err.message ? err : new Error('Client reconnect error'), { cause: err });
        });
    }

    @persist('object') @observable
    private _portConfig: PortRange | undefined;

    @computed get portConfig() {
        return this._portConfig;
    }

    @action
    setPortConfig(value: PortRange | undefined) {
        if (!isValidPortConfiguration(value)) {
            throw new TypeError(`Invalid port config: ${JSON.stringify(value)}`);
        } else if (!value || (value.startPort === 8000 && value.endPort === 65535)) {
            // If unset, or set to the default equivalent value, then
            // we delegate to the server itself.
            this._portConfig = undefined;
        } else {
            this._portConfig = value;
        }
    }

    @computed get httpProxyPort() {
        return this.adminClient.metadata.http.port;
    }

    @persist @observable
    http2Enabled: true | false | 'fallback' = 'fallback';
    private _http2CurrentlyEnabled = this.http2Enabled;
    get http2CurrentlyEnabled() {
        return this._http2CurrentlyEnabled;
    }

    @persist('list') @observable
    tlsPassthroughConfig: Array<{ hostname: string }> = [];
    private _currentTlsPassthroughConfig: Array<{ hostname: string }> = [];
    get currentTlsPassthroughConfig() {
        return this._currentTlsPassthroughConfig;
    }

    setRequestRules = (...rules: RequestRuleData[]) => {
        const { adminStream } = this.adminClient;

        return this.adminClient.sendQuery(
            this.mockttpRequestBuilder.buildAddRequestRulesQuery(rules, true, adminStream)
        );
    }

    setWebSocketRules = (...rules: WebSocketRuleData[]) => {
        const { adminStream } = this.adminClient;

        return this.adminClient.sendQuery(
            this.mockttpRequestBuilder.buildAddWebSocketRulesQuery(rules, true, adminStream)
        );
    }

    setRTCRules = (...rules: MockRTC.MockRTCRuleDefinition[]) => {
        const { adminStream } = this.adminClient;

        return this.adminClient.sendQuery(
            this.mockRTCRequestBuilder.buildSetRulesQuery(rules, adminStream)
        );
    }

    // Proxy event subscriptions through to the server instance:
    onMockttpEvent = (event: InputHTTPEvent, callback: (data: any) => void) => {
        const subRequest = this.mockttpRequestBuilder.buildSubscriptionRequest(event);

        if (!subRequest) {
            // We just return an immediately promise if we don't recognize the event, which will quietly
            // succeed but never call the corresponding callback (the same as the server and most event
            // sources in the same kind of situation). This is what happens when the *client* doesn't
            // recognize the event. Subscribe() below handles the unknown-to-server case.
            console.warn(`Ignoring subscription for event unrecognized by Mockttp client: ${event}`);
            return Promise.resolve();
        }

        return this.adminClient.subscribe(subRequest, callback);
    }

    // Proxy event subscriptions through to the server instance:
    onMockRTCEvent = (event: InputRTCEvent, callback: (data: any) => void) => {
        const subRequest = this.mockRTCRequestBuilder.buildSubscriptionRequest(event);

        if (!subRequest) {
            // We just return an immediately promise if we don't recognize the event, which will quietly
            // succeed but never call the corresponding callback (the same as the server and most event
            // sources in the same kind of situation). This is what happens when the *client* doesn't
            // recognize the event. Subscribe() below handles the unknown-to-server case.
            console.warn(`Ignoring subscription for event unrecognized by MockRTC client: ${event}`);
            return Promise.resolve();
        }

        return this.adminClient.subscribe(subRequest, callback);
    }

    private setNetworkAddresses(networkInterfaces: NetworkInterfaces) {
        this.externalNetworkAddresses = _.flatMap(networkInterfaces, (addresses, iface) => {
            return addresses
                .filter(a =>
                    !a.internal && // Loopback interfaces
                    a.family === "IPv4" && // Android VPN app supports IPv4 only
                    iface !== 'docker0' && // Docker default bridge interface
                    !iface.startsWith('br-') && // More docker bridge interfaces
                    !iface.startsWith('veth') // Virtual interfaces for each docker container
                )
                .map(a => a.address);
        })
    }

    public refreshNetworkAddresses = flow(function* (this: ProxyStore) {
        this.setNetworkAddresses(yield getNetworkInterfaces());
    });

}