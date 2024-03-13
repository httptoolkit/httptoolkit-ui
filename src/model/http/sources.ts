import * as _ from 'lodash';
import { UAParser } from 'ua-parser-js';
import { get } from 'typesafe-get';

import { popColor } from '../../styles';
import { SourceIcons, IconProps, SourceIconName } from '../../icons';

export interface TrafficSource {
    ua: string;
    summary: string;
    description?: string;
    icon: IconProps;
}

function formatVersion(version: string | undefined): string {
    if (!version) return '';

    // Space-prefixed, first two parts only, trim 0s so that '10.0' -> '10'
    return ' ' + version.split('.').slice(0, 2).join('.').replace(/\.0$/, '');
}

const getSummary = (useragent: IUAParser.IResult) => {
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

function getArticle(nextWord: string): string {
    const firstLetter = nextWord[0].toLowerCase();
    // This isn't exactly right (really its vowel _sounds_, not vowels),
    // but it's an ok approximation.
    return (
        firstLetter === 'a' ||
        firstLetter === 'e' ||
        firstLetter === 'i' ||
        firstLetter === 'o' ||
        firstLetter === 'u'
    ) ? 'an ' : 'a ';
}

const getDescription = (useragent: IUAParser.IResult): string | undefined => {
    if (
        !useragent.browser.name &&
        !useragent.os.name &&
        !useragent.device.type
    ) return;

    const browserDescription = useragent.browser.name ?
        useragent.browser.name + formatVersion(useragent.browser.version)
        + (useragent.engine.name ?
            `, based on the ${useragent.engine.name}${
                useragent.engine.name !== 'Blink' // Blink duplicates the Chrome version, noisy
                    ? formatVersion(useragent.engine.version)
                    : ''
             } engine` : '')
    : useragent.engine.name ?
        `a browser built on the ${useragent.engine.name}${
            formatVersion(useragent.engine.version)
        } engine`
    : '';

    const hardwareDescription =
            (useragent.device.vendor ? `${useragent.device.vendor} ` : '') +
            (useragent.device.model ? `${useragent.device.model} ` : '') +
            (useragent.device.type ?
                (useragent.device.type === 'mobile' ?
                    'mobile phone' : useragent.device.type
                + ' ')
            : '');

    const osDescription = useragent.os.name ?
        `running ${useragent.os.name}${formatVersion(useragent.os.version)}` : '';

    const cpuDescription = useragent.cpu.architecture ?
        `${getArticle(
            useragent.cpu.architecture
        )}${useragent.cpu.architecture} CPU` : '';

    const deviceDescription = (hardwareDescription ? `${getArticle(
            hardwareDescription
        )}${hardwareDescription}` : '') +
        (hardwareDescription && osDescription ? ', ' : '') +
        osDescription +
        (cpuDescription ?
            ((hardwareDescription || osDescription) ? ', with ' : ' using ') +
            cpuDescription : '');

    return `This request came from ${
        browserDescription ?
            browserDescription +
            (deviceDescription ? '. The device is ' + deviceDescription : '')
        : hardwareDescription ? // = starts with an article
            deviceDescription : 'a device ' + deviceDescription
    }.`;
}

const isValidIconName = (name: string | undefined): name is SourceIconName => {
    return !!(name && _.has(SourceIcons, name));
}

const getIcon = (useragent: IUAParser.IResult) => {
    const browserName = get(useragent, 'browser', 'name');
    if (isValidIconName(browserName)) return SourceIcons[browserName];

    const uaStrings = useragent.ua.match(/[A-Za-z]+/g) || [];

    const recognizedUaPart = _.find(
        uaStrings.map((s) => _.upperFirst(s.toLowerCase())),
        (s) => isValidIconName(s)
    ) as SourceIconName;

    if (recognizedUaPart) {
        return SourceIcons[recognizedUaPart];
    } else {
        return SourceIcons.Unknown;
    }
};

function checkForElectron(userAgent: IUAParser.IResult) {
    const electronVersion = userAgent.ua.match(/Electron\/(\S+)/);

    if (electronVersion) {
        // If we have a browser & an engine, treat the browser as the engine
        userAgent.engine = userAgent.browser || userAgent.engine;
        // Treat Electron as the 'browser', replacing any existing browser
        userAgent.browser = {
            name: 'Electron',
            version: electronVersion[1],
            major: electronVersion[1].split('.')[0]
        };
    }
}

export const UNKNOWN_SOURCE = {
    ua: '',
    summary: 'Unknown client',
    icon: SourceIcons.Unknown
};

export const MANUALLY_SENT_SOURCE = {
    ua: '',
    summary: 'HTTP Toolkit (Send)',
    description: 'Sent manually from HTTP Toolkit',
    icon: {
        icon: ['far', 'paper-plane'],
        color: popColor
    }
};

export const parseSource = (userAgentHeader: string | undefined): TrafficSource => {
    if (!userAgentHeader) return UNKNOWN_SOURCE;

    const useragent = new UAParser(userAgentHeader).getResult();

    checkForElectron(useragent);

    return {
        ua: useragent.ua,
        summary: getSummary(useragent),
        description: getDescription(useragent),
        icon: getIcon(useragent),
    };
}