import * as _ from 'lodash';
import * as UserAgent from 'ua-parser-js';

import { Icons, IconProps } from '../icons';

export interface TrafficSource {
    ua: string;
    description: string;
    icon: IconProps;
}

const getDescription = (useragent: IUAParser.IResult) => {
    const hasOS = _(useragent.os).values().some();
    const hasBrowser = _(useragent.browser).values().some();

    if (hasOS || hasBrowser) {
        const osDescription = hasOS ? `(${useragent.os.name || ''} ${(useragent.os.version || '').split('.')[0]})` : '';
        const browserDescription = hasBrowser ? `${useragent.browser.name || ''} ${useragent.browser.major || ''}` : 'Unknown client';
        return [browserDescription, osDescription].join(' ');
    } else {
        return _.capitalize(useragent.ua.split(' ')[0]);
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