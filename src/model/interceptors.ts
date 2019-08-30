import * as _ from "lodash";

import { ServerInterceptor } from "../services/server-api";
import { IconProps, SourceIcons } from "../icons";

interface InterceptorUiConfig {
    name: string;
    description: string;
    iconProps: IconProps;
    tags: string[];
    inProgress?: boolean;
}

export type Interceptor =
    Pick<ServerInterceptor, Exclude<keyof ServerInterceptor, 'version'>> &
    InterceptorUiConfig &
    { version?: string, isSupported: boolean };

const BROWSER_TAGS = ['browsers', 'web page', 'web app', 'javascript'];
const MOBILE_TAGS = ['mobile', 'phone', 'app'];
const ANDROID_TAGS = ['samsung', 'galaxy', 'nokia', 'lg', 'android', 'google', 'motorola'];
const IOS_TAGS = ['apple', 'ios', 'iphone', 'ipad'];
const DOCKER_TAGS = ['bridge', 'services', 'images'];

export const MANUAL_INTERCEPT_ID = 'manual-setup';

const INTERCEPT_OPTIONS: _.Dictionary<InterceptorUiConfig> = {
    'docker-all': {
        name: 'All Docker Containers',
        description: 'Intercept all local Docker traffic',
        iconProps: SourceIcons.Docker,
        tags: DOCKER_TAGS
    },
    'docker-specific': {
        name: 'Specific Docker Containers',
        description: 'Intercept all traffic from specific Docker containers',
        iconProps: SourceIcons.Docker,
        tags: DOCKER_TAGS
    },
    'fresh-chrome': {
        name: 'Fresh Chrome',
        description: 'Open a preconfigured fresh Chrome window',
        iconProps: SourceIcons.Chrome,
        tags: BROWSER_TAGS
    },
    'fresh-firefox': {
        name: 'Fresh Firefox',
        description: 'Open a preconfigured fresh Firefox window',
        iconProps: SourceIcons.Firefox,
        tags: BROWSER_TAGS
    },
    'fresh-safari': {
        name: 'Fresh Safari',
        description: 'Open a preconfigured fresh Safari window',
        iconProps: SourceIcons.Safari,
        tags: BROWSER_TAGS
    },
    'fresh-edge': {
        name: 'Fresh Edge',
        description: 'Open a preconfigured fresh Edge window',
        iconProps: SourceIcons.Edge,
        tags: BROWSER_TAGS
    },
    'fresh-terminal': {
        name: 'Terminal',
        description: 'Open a new terminal preconfigured to intercept all launched processes',
        iconProps: SourceIcons.Terminal,
        tags: ['terminal', 'command line', 'cli', 'bash', 'cmd', 'shell', 'php', 'ruby', 'node', 'js']
    },
    'android-device': {
        name: 'An Android device',
        description: 'Intercept all HTTP traffic from an Android device on your network',
        iconProps: SourceIcons.Android,
        tags: [...MOBILE_TAGS, ...ANDROID_TAGS]
    },
    'ios-device': {
        name: 'An iOS device',
        description: 'Intercept all HTTP traffic from an iOS device on your network',
        iconProps: SourceIcons.iOS,
        tags: [...MOBILE_TAGS, ...IOS_TAGS]
    },
    'network-device': {
        name: 'A device on your network',
        description: 'Intercept all HTTP traffic from another device on your network',
        iconProps: SourceIcons.Network,
        tags: [...MOBILE_TAGS, ...IOS_TAGS, ...ANDROID_TAGS, 'lan', 'arp', 'wifi']
    },
    'virtualbox-machine': {
        name: 'A virtualbox VM',
        description: 'Intercept all traffic from a Virtualbox VM',
        iconProps: SourceIcons.Desktop,
        tags: ['virtual machine', 'vagrant']
    },
    'system-proxy': {
        name: 'Everything',
        description: 'Intercept all HTTP traffic on this machine',
        iconProps: SourceIcons.Desktop,
        tags: ['local', 'machine', 'system', 'me']
    },
    [MANUAL_INTERCEPT_ID]: {
        name: 'Anything',
        description: 'Manually configure any source using the proxy settings and CA certificate',
        iconProps: SourceIcons.Unknown,
        tags: []
    }
};

export function getInterceptOptions(serverInterceptorArray: ServerInterceptor[]) {
    const serverInterceptors = _.keyBy(serverInterceptorArray, 'id');

    return _.mapValues(INTERCEPT_OPTIONS, (option, id) => {
        if (id === MANUAL_INTERCEPT_ID) {
            return _.assign({}, option, {
                id: id,
                isSupported: true,
                isActive: false,
                isActivable: true
            });
        } else {
            const serverInterceptor = serverInterceptors[id] || {
                isActive: false,
                isActivable: false
            };

            return _.assign({}, option, serverInterceptor, {
                id: id,
                isSupported: !!serverInterceptors[id]
            });
        }
    });
}