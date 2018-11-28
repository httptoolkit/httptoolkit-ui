import * as _ from "lodash";

import { ServerInterceptor } from "./htk-client";
import { IconProps, Icons } from "../icons";

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

const MOBILE_TAGS =['mobile', 'phone', 'apple', 'samsung', 'ios', 'android', 'app'];
const DOCKER_TAGS = ['bridge', 'services', 'images'];

export const MANUAL_INTERCEPT_ID = 'manual-setup';

const INTERCEPT_OPTIONS: _.Dictionary<InterceptorUiConfig> = {
    'fresh-chrome': {
        name: 'Fresh Chrome',
        description: 'Open a preconfigured fresh Chrome window',
        iconProps: Icons.Chrome,
        tags: ['browsers', 'web page']
    },
    'fresh-firefox': {
        name: 'Fresh Firefox',
        description: 'Open a preconfigured fresh Firefox window',
        iconProps: Icons.Firefox,
        tags: ['browsers', 'web page']
    },
    'docker-all': {
        name: 'All Docker Containers',
        description: 'Intercept all local Docker traffic',
        iconProps: Icons.Docker,
        tags: DOCKER_TAGS
    },
    'docker-specific': {
        name: 'Specific Docker Containers',
        description: 'Intercept all traffic from specific Docker containers',
        iconProps: Icons.Docker,
        tags: DOCKER_TAGS
    },
    'network-device': {
        name: 'A device on your network',
        description: 'Intercept all HTTP traffic from another device on your network',
        iconProps: Icons.Network,
        tags: [...MOBILE_TAGS, 'lan', 'arp', 'wifi']
    },
    'system-proxy': {
        name: 'Everything',
        description: 'Intercept all HTTP traffic on this machine',
        iconProps: Icons.Desktop,
        tags: ['local', 'machine', 'system', 'me']
    },
    [MANUAL_INTERCEPT_ID]: {
        name: 'Manual setup',
        description: 'Manually configure a source with the proxy settings and certificate',
        iconProps: Icons.Unknown,
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