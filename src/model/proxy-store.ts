import * as _ from 'lodash';
import {
    observable,
    action,
    flow,
    computed,
    observe,
    runInAction,
} from 'mobx';
import { getRemote, Mockttp, ProxyConfig } from 'mockttp';

import {
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
import { lazyObservablePromise } from '../util/observable';
import { persist, hydrate } from '../util/mobx-persist/persist';
import { isValidPort } from './network';
import { serverVersion } from '../services/service-versions';

// Start the server, with slowly decreasing retry frequency (up to a limit).
// Note that this never fails - any timeout to this process needs to happen elsewhere.
function startServer(
    server: Mockttp,
    portConfig: PortRange | undefined,
    maxDelay = 500,
    delayMs = 200
): Promise<void> {
    return server.start(portConfig).catch((e) => {
        console.log('Server initialization failed', e);

        if (e.response) {
            // Server is listening, but failed to start as requested. Almost
            // certainly means our port config is bad - retry immediately without it.
            return startServer(server, undefined, maxDelay, delayMs);
        }

        // For anything else (unknown errors, or more likely server not listening yet),
        // wait briefly and then retry the same config:
        return delay(Math.min(delayMs, maxDelay)).then(() =>
            startServer(server, portConfig, maxDelay, delayMs * 1.2)
        );
    });
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
    private server!: Mockttp; // Definitely set *after* initialization

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
    systemProxyConfig: ProxyConfig | undefined;

    @observable
    dnsServers: string[] = [];

    @observable
    serverVersion!: string; // Definitely set *after* initialization

    readonly initialized = lazyObservablePromise(async () => {
        await this.accountStore.initialized;

        await this.loadSettings();
        await this.startIntercepting();
        this.serverVersion = await serverVersion;
        console.log('Proxy store initialized');
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
            }
        });

        // Load all persisted settings from storage
        await hydrate({
            key: 'server-store',
            store: this
        });

        // Backward compat for store data before 2020-01-28 - drop this in a month or two
        const rawData = localStorage.getItem('interception-store');
        if (rawData) {
            try {
                const data = JSON.parse(rawData);

                // Migrate data from the interception store to here:
                if (data._portConfig) {
                    runInAction(() => {
                        this._portConfig = data._portConfig;
                    });
                }
            } catch (e) {
                console.log(e);
            }
        }

        console.log('Proxy settings loaded');
    }

    private startIntercepting = flow(function* (this: ProxyStore) {
        this.server = getRemote({
            cors: false,
            suggestChanges: false,
            standaloneServerUrl: 'http://127.0.0.1:45456',
            // User configurable settings:
            http2: this.http2Enabled
        });
        this._http2CurrentlyEnabled = this.http2Enabled;

        yield startServer(this.server, this._portConfig);
        announceServerReady();
        console.log('Server started');

        yield getConfig(this.serverPort).then((config) => {
            this.certPath = config.certificatePath;
            this.certContent = config.certificateContent;
            this.certFingerprint = config.certificateFingerprint;
            this.setNetworkAddresses(config.networkInterfaces);
            this.systemProxyConfig = config.systemProxy;
            this.dnsServers = config.dnsServers;
            console.log('Config loaded');
        });

        // Everything seems to agree that here we're 'done'
        console.log(`Server started on port ${this.server.port}`);

        window.addEventListener('beforeunload', () => {
            this.server.stop().catch(() => { });
        });
    });

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

    @computed get serverPort() {
        return this.server.port;
    }

    @persist @observable
    http2Enabled: true | false | 'fallback' = 'fallback';
    private _http2CurrentlyEnabled = this.http2Enabled;
    get http2CurrentlyEnabled() {
        return this._http2CurrentlyEnabled;
    }

    // Proxy request rules config through to the server instance:
    @computed get setRequestRules() {
        return this.server.setRequestRules.bind(this.server);
    }

    // Proxy websocket rules config through to the server instance:
    @computed get setWebSocketRules() {
        return this.server.setWebSocketRules.bind(this.server);
    }

    // Proxy event subscriptions through to the server instance:
    @computed get onServerEvent() {
        return this.server.on.bind(this.server);
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