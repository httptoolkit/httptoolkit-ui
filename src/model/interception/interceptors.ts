import * as _ from "lodash";

import { ServerInterceptor } from "../../services/server-api";
import {
    versionSatisfies,
    DETAILED_CONFIG_RANGE,
    DOCKER_INTERCEPTION_RANGE
} from "../../services/service-versions";
import { IconProps, SourceIcons } from "../../icons";
import { AccountStore } from "../account/account-store";

import { InterceptorCustomUiConfig } from "../../components/intercept/intercept-option";
import { ManualInterceptCustomUi } from "../../components/intercept/config/manual-intercept-config";
import { ExistingTerminalCustomUi } from "../../components/intercept/config/existing-terminal-config";
import { ElectronCustomUi } from '../../components/intercept/config/electron-config';
import { AndroidDeviceCustomUi } from "../../components/intercept/config/android-device-config";
import { AndroidAdbCustomUi } from "../../components/intercept/config/android-adb-config";
import { ExistingBrowserCustomUi } from "../../components/intercept/config/existing-browser-config";
import { JvmCustomUi } from "../../components/intercept/config/jvm-config";
import { DockerAttachCustomUi } from "../../components/intercept/config/docker-attach-config";

interface InterceptorConfig {
    name: string;
    description: string[];
    iconProps: IconProps | Array<IconProps>;
    tags: string[];
    inProgress?: boolean;
    clientOnly?: true;
    checkRequirements?: (options: {
        interceptorVersion: string,
        accountStore: AccountStore,
        serverVersion?: string
    }) => boolean;
    uiConfig?: InterceptorCustomUiConfig;
    getActivationOptions?: (options: { accountStore: AccountStore }) => unknown;
}

export type Interceptor =
    Pick<ServerInterceptor, Exclude<keyof ServerInterceptor, 'version'>> &
    InterceptorConfig &
    { version?: string, isSupported: boolean, activationOptions: unknown | undefined };

const BROWSER_TAGS = ['browsers', 'web', 'pwa'];
const JVM_TAGS = ['jvm', 'java', 'scala', 'kotlin', 'clojure', 'groovy'];
const MOBILE_TAGS = ['mobile', 'phone', 'app'];
const ANDROID_TAGS = ['samsung', 'galaxy', 'nokia', 'lg', 'android', 'google', 'motorola', ...JVM_TAGS];
const IOS_TAGS = ['apple', 'ios', 'iphone', 'ipad'];
const DOCKER_TAGS = ['bridge', 'services', 'images'];
const TERMINAL_TAGS = ['command line', 'cli', 'bash', 'cmd', 'shell', 'php', 'ruby', 'node', 'js', ...JVM_TAGS];

const androidInterceptIconProps = _.assign({
    style: { transform: 'translateY(32px)' }
}, SourceIcons.Android);

const recoloured = (icon: IconProps, color: string) => ({ ...icon, color });

export const MANUAL_INTERCEPT_ID = 'manual-setup';

const INTERCEPT_OPTIONS: _.Dictionary<InterceptorConfig> = {
    'docker-attach': {
        name: 'Attach to Docker Container',
        description: ["Intercept all traffic from running Docker containers"],
        uiConfig: DockerAttachCustomUi,
        iconProps: SourceIcons.Docker,
        checkRequirements: ({ accountStore, serverVersion }) => {
            return accountStore.featureFlags.includes('docker') &&
                versionSatisfies(serverVersion || '', DOCKER_INTERCEPTION_RANGE);
        },
        tags: DOCKER_TAGS
    },
    'fresh-chrome': {
        name: 'Chrome',
        description: ["Intercept a fresh independent Chrome window"],
        iconProps: SourceIcons.Chrome,
        tags: BROWSER_TAGS
    },
    'existing-chrome': {
        name: 'Global Chrome',
        description: [
            "Intercept your main Chrome profile globally",
            "This captures all default Chrome traffic, so may interfere with normal usage"
        ],
        uiConfig: ExistingBrowserCustomUi,
        iconProps: [
            SourceIcons.Chrome,
            { icon: ['fas', 'globe'], color: '#fafafa', size: '2x' }
        ],
        tags: BROWSER_TAGS
    },
    'fresh-chrome-beta': {
        name: 'Chrome (beta)',
        description: ["Intercept a fresh independent Chrome window"],
        iconProps: recoloured(SourceIcons.Chrome, '#DB4437'),
        tags: BROWSER_TAGS
    },
    'fresh-chrome-dev': {
        name: 'Chrome (dev)',
        description: ["Intercept a fresh independent Chrome window"],
        iconProps: recoloured(SourceIcons.Chrome, '#74929f'),
        tags: BROWSER_TAGS
    },
    'fresh-chrome-canary': {
        name: 'Chrome (canary)',
        description: ["Intercept a fresh independent Chrome window"],
        iconProps: recoloured(SourceIcons.Chrome, '#e8ab01'),
        tags: BROWSER_TAGS
    },
    'fresh-chromium': {
        name: 'Chromium',
        description: ["Intercept a fresh independent Chromium window"],
        iconProps: SourceIcons.Chromium,
        tags: BROWSER_TAGS
    },
    'fresh-chromium-dev': {
        name: 'Chromium (dev)',
        description: ["Intercept a fresh independent Chromium window"],
        iconProps: recoloured(SourceIcons.Chromium, '#74929f'),
        tags: BROWSER_TAGS
    },
    'fresh-brave': {
        name: 'Brave',
        description: ["Intercept a fresh independent Brave window"],
        iconProps: SourceIcons.Brave,
        tags: BROWSER_TAGS
    },
    'fresh-firefox': {
        name: 'Firefox',
        description: ["Intercept a fresh independent Firefox window"],
        iconProps: SourceIcons.Firefox,
        tags: BROWSER_TAGS,
        checkRequirements: ({ interceptorVersion }) => {
            return versionSatisfies(interceptorVersion, "^1.1.0")
        },
    },
    'fresh-safari': {
        name: 'Safari',
        description: ["Intercept a fresh independent Safari window"],
        iconProps: SourceIcons.Safari,
        tags: BROWSER_TAGS
    },
    'fresh-edge': {
        name: 'Edge',
        description: ["Intercept a fresh independent Edge window"],
        iconProps: SourceIcons.Edge,
        tags: BROWSER_TAGS
    },
    'fresh-edge-beta': {
        name: 'Edge (beta)',
        description: ["Intercept a fresh independent Edge window"],
        iconProps: recoloured(SourceIcons.Edge, '#50e6ff'),
        tags: BROWSER_TAGS
    },
    'fresh-edge-dev': {
        name: 'Edge (dev)',
        description: ["Intercept a fresh independent Edge window"],
        iconProps: recoloured(SourceIcons.Edge, '#74929f'),
        tags: BROWSER_TAGS
    },
    'fresh-edge-canary': {
        name: 'Edge (canary)',
        description: ["Intercept a fresh independent Edge window"],
        iconProps: recoloured(SourceIcons.Edge, '#ffc225'),
        tags: BROWSER_TAGS
    },
    'fresh-opera': {
        name: 'Opera',
        description: ["Intercept a fresh independent Opera window"],
        iconProps: SourceIcons.Opera,
        tags: BROWSER_TAGS,
        checkRequirements: ({ interceptorVersion }) => {
            return versionSatisfies(interceptorVersion, "^1.0.3")
        },
    },
    'attach-jvm': {
        name: 'Attach to JVM',
        description: [
            'Attach to any local running JVM process, including Java, Kotlin & Clojure'
        ],
        iconProps: SourceIcons.Java,
        uiConfig: JvmCustomUi,
        tags: JVM_TAGS
    },
    'fresh-terminal': {
        name: 'Fresh Terminal',
        description: ["Open a new terminal preconfigured to intercept all launched processes"],
        iconProps: SourceIcons.Terminal,
        tags: TERMINAL_TAGS,
        getActivationOptions: ({ accountStore }) =>
            accountStore.featureFlags.includes('docker')
            ? { dockerEnabled: true }
            : {}
    },
    'existing-terminal': {
        name: 'Existing Terminal',
        description: ["Intercept all launched processes from one of your existing terminal windows"],
        iconProps: recoloured(SourceIcons.Terminal, '#dd44dd'),
        uiConfig: ExistingTerminalCustomUi,
        tags: TERMINAL_TAGS
    },
    'android-adb': {
        name: 'Android device connected via ADB',
        description: [
            'Intercept an Android device or emulator connected to ADB',
            'Automatically injects system HTTPS certificates into rooted devices & most emulators'
        ],
        iconProps: androidInterceptIconProps,
        checkRequirements: ({ serverVersion }) => {
            return versionSatisfies(serverVersion || '', DETAILED_CONFIG_RANGE);
        },
        uiConfig: AndroidAdbCustomUi,
        tags: [...MOBILE_TAGS, ...ANDROID_TAGS, 'emulator', 'root', 'adb']
    },
    'android-device': {
        name: 'Android device via QR code',
        description: [
            'Intercept any Android device on your network',
            'Manual setup required for HTTPS in some apps'
        ],
        iconProps: recoloured(androidInterceptIconProps, '#4285F4'),
        checkRequirements: ({ serverVersion }) => {
            return versionSatisfies(serverVersion || '', DETAILED_CONFIG_RANGE);
        },
        clientOnly: true,
        uiConfig: AndroidDeviceCustomUi,
        tags: [...MOBILE_TAGS, ...ANDROID_TAGS]
    },
    'ios-device': {
        name: 'An iOS device',
        description: ["Intercept all HTTP traffic from an iOS device on your network"],
        iconProps: SourceIcons.iOS,
        tags: [...MOBILE_TAGS, ...IOS_TAGS]
    },
    'network-device': {
        name: 'A device on your network',
        description: ["Intercept all HTTP traffic from another device on your network"],
        iconProps: SourceIcons.Network,
        tags: [...MOBILE_TAGS, ...IOS_TAGS, ...ANDROID_TAGS, 'lan', 'arp', 'wifi']
    },
    'virtualbox-machine': {
        name: 'A virtualbox VM',
        description: ["Intercept all traffic from a Virtualbox VM"],
        iconProps: SourceIcons.Desktop,
        tags: ['virtual machine', 'vagrant']
    },
    'system-proxy': {
        name: 'Everything',
        description: ["Intercept all HTTP traffic on this machine"],
        iconProps: SourceIcons.Desktop,
        tags: ['local', 'machine', 'system', 'me']
    },
    'electron': {
        name: 'Electron Application',
        description: ["Launch an Electron application with all its traffic intercepted"],
        iconProps: SourceIcons.Electron,
        uiConfig: ElectronCustomUi,
        checkRequirements: ({ interceptorVersion }) => {
            return versionSatisfies(interceptorVersion, "^1.0.1")
        },
        tags: ['electron', 'desktop', 'postman']
    },
    [MANUAL_INTERCEPT_ID]: {
        name: 'Anything',
        description: ["Manually configure any source using the proxy settings and CA certificate"],
        iconProps: SourceIcons.Unknown,
        clientOnly: true,
        uiConfig: ManualInterceptCustomUi,
        tags: []
    }
};

export function getInterceptOptions(
    serverInterceptorArray: ServerInterceptor[],
    accountStore: AccountStore,
    serverVersion?: string
) {
    const serverInterceptors = _.keyBy(serverInterceptorArray, 'id');

    return _.mapValues(INTERCEPT_OPTIONS, (option, id) => {
        if (
            // If we need a server interceptor & it's not present
            (!option.clientOnly && !serverInterceptors[id]) ||
            // Or if we're missing other requirement (specific server version,
            // feature flags, etc)
            (option.checkRequirements && !option.checkRequirements({
                interceptorVersion: (serverInterceptors[id] || {}).version,
                accountStore,
                serverVersion
            }))
        ) {
            // The UI knows about this interceptor, but we can't use it for some reason.
            return _.assign({}, option, {
                id: id,
                isSupported: false,
                isActive: false,
                isActivable: false,
                activationOptions: undefined
            });
        } else if (option.clientOnly) {
            // Some interceptors don't need server support at all, so as long as the requirements
            // are fulfilled, they're always supported & activable (e.g. manual setup guide).
            return _.assign({}, option, {
                id: id,
                isSupported: true,
                isActive: false,
                isActivable: true,
                activationOptions: option.getActivationOptions
                    ? option.getActivationOptions({ accountStore })
                    : undefined
            });
        } else {
            // For everything else: the UI & server supports this, we let the server tell us
            // if it's activable/currently active.
            const serverInterceptor = serverInterceptors[id];

            return _.assign({}, option, serverInterceptor, {
                id,
                isSupported: true,
                activationOptions: option.getActivationOptions
                    ? option.getActivationOptions({ accountStore })
                    : undefined
            });
        }
    });
}