import * as _ from "lodash";
import * as semver from "semver";

import { ServerInterceptor } from "../../services/server-api";
import { DETAILED_CONFIG_RANGE } from "../../services/service-versions";
import { IconProps, SourceIcons } from "../../icons";
import { AccountStore } from "../account/account-store";

import { InterceptorCustomUiConfig } from "../../components/intercept/intercept-option";
import { ManualInterceptCustomUi } from "../../components/intercept/config/manual-intercept-config";
import { ExistingTerminalCustomUi } from "../../components/intercept/config/existing-terminal-config";
import { ElectronCustomUi } from '../../components/intercept/config/electron-config';
import { AndroidDeviceCustomUi } from "../../components/intercept/config/android-device-config";
import { AndroidAdbCustomUi } from "../../components/intercept/config/android-adb-config";

interface InterceptorConfig {
    name: string;
    description: string[];
    iconProps: IconProps;
    tags: string[];
    inProgress?: boolean;
    clientOnly?: true;
    checkRequirements?: (options: {
        interceptorVersion: string,
        accountStore: AccountStore,
        serverVersion?: string
    }) => boolean;
    uiConfig?: InterceptorCustomUiConfig;
}

export type Interceptor =
    Pick<ServerInterceptor, Exclude<keyof ServerInterceptor, 'version'>> &
    InterceptorConfig &
    { version?: string, isSupported: boolean };

const BROWSER_TAGS = ['browsers', 'web page', 'web app', 'javascript'];
const MOBILE_TAGS = ['mobile', 'phone', 'app'];
const ANDROID_TAGS = ['samsung', 'galaxy', 'nokia', 'lg', 'android', 'google', 'motorola'];
const IOS_TAGS = ['apple', 'ios', 'iphone', 'ipad'];
const DOCKER_TAGS = ['bridge', 'services', 'images'];

export const MANUAL_INTERCEPT_ID = 'manual-setup';

const INTERCEPT_OPTIONS: _.Dictionary<InterceptorConfig> = {
    'docker-all': {
        name: 'All Docker Containers',
        description: ["Intercept all local Docker traffic"],
        iconProps: SourceIcons.Docker,
        tags: DOCKER_TAGS
    },
    'docker-specific': {
        name: 'Specific Docker Containers',
        description: ["Intercept all traffic from specific Docker containers"],
        iconProps: SourceIcons.Docker,
        tags: DOCKER_TAGS
    },
    'fresh-chrome': {
        name: 'Fresh Chrome',
        description: ["Open a preconfigured fresh Chrome window"],
        iconProps: SourceIcons.Chrome,
        tags: BROWSER_TAGS
    },
    'fresh-firefox': {
        name: 'Fresh Firefox',
        description: ["Open a preconfigured fresh Firefox window"],
        iconProps: SourceIcons.Firefox,
        tags: BROWSER_TAGS
    },
    'fresh-safari': {
        name: 'Fresh Safari',
        description: ["Open a preconfigured fresh Safari window"],
        iconProps: SourceIcons.Safari,
        tags: BROWSER_TAGS
    },
    'fresh-edge': {
        name: 'Fresh Edge',
        description: ["Open a preconfigured fresh Edge window"],
        iconProps: SourceIcons.Edge,
        tags: BROWSER_TAGS
    },
    'fresh-terminal': {
        name: 'Fresh Terminal',
        description: ["Open a new terminal preconfigured to intercept all launched processes"],
        iconProps: SourceIcons.Terminal,
        tags: ['terminal', 'command line', 'cli', 'bash', 'cmd', 'shell', 'php', 'ruby', 'node', 'js']
    },
    'existing-terminal': {
        name: 'Existing Terminal',
        description: ["Intercept all launched processes from one of your existing terminal windows"],
        iconProps: _.defaults({ color: '#dd44dd' }, SourceIcons.Terminal),
        uiConfig: ExistingTerminalCustomUi,
        tags: ['terminal', 'command line', 'cli', 'bash', 'cmd', 'shell', 'php', 'ruby', 'node', 'js']
    },
    'electron': {
        name: 'Electron Application',
        description: ["Launch an Electron application with all its traffic intercepted"],
        iconProps: SourceIcons.Electron,
        uiConfig: ElectronCustomUi,
        checkRequirements: ({ interceptorVersion }) => {
            return semver.satisfies(interceptorVersion, "^1.0.1")
        },
        tags: ['electron', 'desktop', 'postman']
    },
    'android-device': {
        name: 'Android device',
        description: [
            'Intercept an Android device on your network',
            'Manual setup required for HTTPS in some apps'
        ],
        iconProps: SourceIcons.Android,
        checkRequirements: ({ accountStore, serverVersion }) => {
            return semver.satisfies(serverVersion || '', DETAILED_CONFIG_RANGE) &&
                accountStore.featureFlags.includes("android");
        },
        clientOnly: true,
        uiConfig: AndroidDeviceCustomUi,
        tags: [...MOBILE_TAGS, ...ANDROID_TAGS]
    },
    'android-adb': {
        name: 'Android device connected via ADB',
        description: [
            'Intercept any Android device or emulator connected to ADB',
            'Automatically injects system HTTPS certificates into rooted devices & most emulators'
        ],
        iconProps: _.defaults({ color: '#4285F4' }, SourceIcons.Android),
        checkRequirements: ({ accountStore, serverVersion }) => {
            return semver.satisfies(serverVersion || '', DETAILED_CONFIG_RANGE) &&
                accountStore.featureFlags.includes("android")
        },
        uiConfig: AndroidAdbCustomUi,
        tags: [...MOBILE_TAGS, ...ANDROID_TAGS, 'emulator', 'root', 'adb']
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
                isActivable: false
            });
        } else if (option.clientOnly) {
            // Some interceptors don't need server support at all, so as long as the requirements
            // are fulfilled, they're always supported & activable (e.g. manual setup guide).
            return _.assign({}, option, {
                id: id,
                isSupported: true,
                isActive: false,
                isActivable: true
            });
        } else {
            // For everything else: the UI & server supports this, we let the server tell us
            // if it's activable/currently active.
            const serverInterceptor = serverInterceptors[id];

            return _.assign({}, option, serverInterceptor, {
                id,
                isSupported: true
            });
        }
    });
}