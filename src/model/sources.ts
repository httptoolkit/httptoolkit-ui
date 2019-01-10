import * as _ from 'lodash';
import * as UserAgent from 'ua-parser-js';

import { Icons, IconProps } from '../icons';

export interface TrafficSource {
    ua: string;
    description: string;
    icon: IconProps;
}

function formatVersion(version: string | undefined): string {
    if (!version) return '';

    // Space-prefixed, first two parts only, trim 0s so that '10.0' -> '10'
    return ' ' + version.split('.').slice(0, 2).join('.').replace(/\.0$/, '');
}

const getDescription = (useragent: IUAParser.IResult) => {
    const hasOS = _(useragent.os).values().some();
    const hasBrowser = _(useragent.browser).values().some();

    const clientName = _.upperFirst(useragent.ua.split(' ')[0]);

    if (hasOS || hasBrowser) {
        const osDescription = hasOS ?
            ` (${_.upperFirst(useragent.os.name)}${formatVersion(useragent.os.version)})`
        : '';
        const browserDescription = hasBrowser ?
            (useragent.browser.name || '') + formatVersion(useragent.browser.version)
        : clientName;

        return browserDescription + osDescription;
    } else {
        return clientName;
    }
};

const isValidIconName = (name: string | undefined): name is keyof typeof Icons => {
    return !!(name && _.has(Icons, name));
}

const getIcon = (useragent: IUAParser.IResult) => {
    if (isValidIconName(useragent.browser.name)) {
        return Icons[useragent.browser.name];
    } else {
        return Icons.Unknown;
    }
};

export const parseSource = (userAgentHeader: string): TrafficSource => {
    const useragent = new UserAgent(userAgentHeader).getResult();

    return {
        ua: useragent.ua,
        description: getDescription(useragent),
        icon: getIcon(useragent),
    };
}