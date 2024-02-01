import * as React from 'react';
import { styled, warningColor } from './styles';

// Import required FA icons:
import {
    library,
    IconPrefix,
    IconName,
    IconLookup,
    icon,
    IconParams,
    IconProp,
    SizeProp
} from '@fortawesome/fontawesome-svg-core';

import { faSpinner } from '@fortawesome/free-solid-svg-icons/faSpinner';
import { faTrashAlt } from '@fortawesome/free-regular-svg-icons/faTrashAlt';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowLeft';
import { faSearch } from '@fortawesome/free-solid-svg-icons/faSearch';
import { faPlug } from '@fortawesome/free-solid-svg-icons/faPlug';
import { faNetworkWired } from '@fortawesome/free-solid-svg-icons/faNetworkWired';
import { faDesktop } from '@fortawesome/free-solid-svg-icons/faDesktop';
import { faTerminal } from '@fortawesome/free-solid-svg-icons/faTerminal';
import { faQuestion } from '@fortawesome/free-solid-svg-icons/faQuestion';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import { faChevronUp } from '@fortawesome/free-solid-svg-icons/faChevronUp';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faBan } from '@fortawesome/free-solid-svg-icons/faBan';
import { faComment } from '@fortawesome/free-regular-svg-icons/faComment';
import { faToggleOn } from '@fortawesome/free-solid-svg-icons/faToggleOn';
import { faToggleOff } from '@fortawesome/free-solid-svg-icons/faToggleOff';
import { faCopy } from '@fortawesome/free-regular-svg-icons/faCopy';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons/faExternalLinkAlt';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons/faExclamationTriangle';
import { faExclamation } from '@fortawesome/free-solid-svg-icons/faExclamation';
import { faLightbulb } from '@fortawesome/free-solid-svg-icons/faLightbulb';
import { faCog } from '@fortawesome/free-solid-svg-icons/faCog';
import { faStar } from '@fortawesome/free-regular-svg-icons/faStar';
import { faMagic } from '@fortawesome/free-solid-svg-icons/faMagic';
import { faSun } from '@fortawesome/free-solid-svg-icons/faSun';
import { faMoon } from '@fortawesome/free-solid-svg-icons/faMoon';
import { faAdjust } from '@fortawesome/free-solid-svg-icons/faAdjust';
import { faUpload } from '@fortawesome/free-solid-svg-icons/faUpload';
import { faDownload } from '@fortawesome/free-solid-svg-icons/faDownload';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faPause } from '@fortawesome/free-solid-svg-icons/faPause';
import { faGem } from '@fortawesome/free-solid-svg-icons/faGem';
import { faTheaterMasks } from '@fortawesome/free-solid-svg-icons/faTheaterMasks';
import { faGripVertical } from '@fortawesome/free-solid-svg-icons/faGripVertical';
import { faUndo } from '@fortawesome/free-solid-svg-icons/faUndo';
import { faSave } from '@fortawesome/free-solid-svg-icons/faSave';
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons/faFolderOpen';
import { faUnlock } from '@fortawesome/free-solid-svg-icons/faUnlock';
import { faEdit } from '@fortawesome/free-solid-svg-icons/faEdit';
import { faWindowMaximize } from '@fortawesome/free-regular-svg-icons/faWindowMaximize';
import { faMobileAlt } from '@fortawesome/free-solid-svg-icons/faMobileAlt';
import { faExpand } from '@fortawesome/free-solid-svg-icons/faExpand';
import { faCompressArrowsAlt } from '@fortawesome/free-solid-svg-icons/faCompressArrowsAlt';
import { faThumbtack } from '@fortawesome/free-solid-svg-icons/faThumbtack';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faCaretDown } from '@fortawesome/free-solid-svg-icons/faCaretDown';
import { faAlignLeft } from '@fortawesome/free-solid-svg-icons/faAlignLeft';
import { faClone } from '@fortawesome/free-regular-svg-icons/faClone';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';
import { faLevelDownAlt } from '@fortawesome/free-solid-svg-icons/faLevelDownAlt';
import { faPaperPlane } from '@fortawesome/free-regular-svg-icons/faPaperPlane';

import { faChrome } from '@fortawesome/free-brands-svg-icons/faChrome';
import { faFirefox } from '@fortawesome/free-brands-svg-icons/faFirefox';
import { faDocker } from '@fortawesome/free-brands-svg-icons/faDocker';
import { faAndroid } from '@fortawesome/free-brands-svg-icons/faAndroid';
import { faApple } from '@fortawesome/free-brands-svg-icons/faApple';
import { faSafari } from '@fortawesome/free-brands-svg-icons/faSafari';
import { faEdge } from '@fortawesome/free-brands-svg-icons/faEdge';
import { faInternetExplorer } from '@fortawesome/free-brands-svg-icons/faInternetExplorer';
import { faOpera } from '@fortawesome/free-brands-svg-icons/faOpera';
import { faCodeBranch } from '@fortawesome/free-solid-svg-icons/faCodeBranch';
import { faNpm } from '@fortawesome/free-brands-svg-icons/faNpm';
import { faNodeJs } from '@fortawesome/free-brands-svg-icons/faNodeJs';
import { faPhp } from '@fortawesome/free-brands-svg-icons/faPhp';
import { faPython } from '@fortawesome/free-brands-svg-icons/faPython';
import { faAtom } from '@fortawesome/free-solid-svg-icons/faAtom';
import { faGlobe } from '@fortawesome/free-solid-svg-icons/faGlobe';
import { faJava } from '@fortawesome/free-brands-svg-icons/faJava';

import { customSpinnerArc } from './images/custom-spinner';
import { braveBrowser } from './images/brave-browser-logo';
import { arcBrowser } from './images/arc-browser-logo';

library.add(
    customSpinnerArc,

    faArrowLeft,
    faSpinner,
    faTrashAlt,
    faSearch,
    faPlug,
    faNetworkWired,
    faDesktop,
    faTerminal,
    faQuestion,
    faTimes,
    faChevronUp,
    faChevronDown,
    faBan,
    faComment,
    faToggleOn,
    faToggleOff,
    faCopy,
    faExternalLinkAlt,
    faPlus,
    faMinus,
    faExclamationTriangle,
    faExclamation,
    faLightbulb,
    faCog,
    faStar,
    faMagic,
    faSun,
    faMoon,
    faAdjust,
    faUpload,
    faDownload,
    faPlay,
    faPause,
    faGem,
    faTheaterMasks,
    faGripVertical,
    faUndo,
    faSave,
    faFolderOpen,
    faUnlock,
    faEdit,
    faWindowMaximize,
    faMobileAlt,
    faExpand,
    faCompressArrowsAlt,
    faThumbtack,
    faEye,
    faCaretDown,
    faAlignLeft,
    faClone,
    faCheck,
    faLevelDownAlt,
    faPaperPlane,

    faChrome,
    faFirefox,
    faDocker,
    faAndroid,
    faApple,
    faSafari,
    faEdge,
    faInternetExplorer,
    faOpera,
    braveBrowser,
    arcBrowser,
    faCodeBranch,
    faNpm,
    faNodeJs,
    faPhp,
    faPython,
    faAtom,
    faGlobe,
    faJava
);

export interface IconProps {
    icon: ExtendedIconProp;
    color: string;
    size?: SizeProp;
}

export type SourceIconName = keyof typeof SourceIcons;

export const SourceIcons = {
    Chrome: { icon: ['fab', 'chrome'], color: '#1da462' },
    Chromium: { icon: ['fab', 'chrome'], color: '#4489f4' },
    Firefox: { icon: ['fab', 'firefox'], color: '#e66000' },
    Safari: { icon: ['fab', 'safari'], color: '#448aff' },
    Edge: { icon: ['fab', 'edge'], color: '#2c75be' },
    IE: { icon: ['fab', 'internet-explorer'], color: '#00baf0' },
    Opera: { icon: ['fab', 'opera'], color: '#cb0b1e' },
    Brave: { icon: ['fac', 'brave-browser'], color: '#fb542b' },
    Arc: { icon: ['fac', 'arc-browser'], color: '#ff536a' },
    Git: { icon: ['fas', 'code-branch'], color: '#f05033' },
    Php: { icon: ['fab', 'php'], color: '#8892bf' },

    Ruby: { icon: ['fas', 'gem'], color: '#CC342D' },
    Faraday: { icon: ['fas', 'gem'], color: '#CC342D' }, // Popular Ruby HTTP lib
    Excon: { icon: ['fas', 'gem'], color: '#CC342D' }, // Popular Ruby HTTP lib
    Typhoeus: { icon: ['fas', 'gem'], color: '#CC342D' }, // Popular Ruby HTTP lib
    Rubybindings: { icon: ['fas', 'gem'], color: '#CC342D' }, // Stripe's Ruby HTTP lib

    Npm: { icon: ['fab', 'npm'], color: '#cc3534' },
    Node: { icon: ['fab', 'node-js'], color: '#3c873a' },
    Got: { icon: ['fab', 'node-js'], color: '#3c873a' }, // Popular Node.js HTTP lib
    Axios: { icon: ['fab', 'node-js'], color: '#3c873a' }, // Popular Node.js HTTP lib
    Nodebindings: { icon: ['fab', 'node-js'], color: '#3c873a' }, // Stripe's Node.js HTTP lib

    Pip: { icon: ['fab', 'python'], color: '#646464' },
    Python: { icon: ['fab', 'python'], color: '#4584b6' },
    Urlfetch: { icon: ['fab', 'python'], color: '#4584b6' }, // Popular Python HTTP lib
    Pycurl: { icon: ['fab', 'python'], color: '#4584b6' }, // Popular Python HTTP lib
    Pythonbindings: { icon: ['fab', 'python'], color: '#4584b6' }, // Stripe's Python HTTP lib

    Java: { icon: ['fab', 'java'], color: '#007396' },
    Reactornetty: { icon: ['fab', 'java'], color: '#007396' }, // Popular Java lib
    Jetty: { icon: ['fab', 'java'], color: '#007396' }, // Popular Java lib
    Jakarta: { icon: ['fab', 'java'], color: '#007396' }, // Old name for Apache HttpClient, popular lib
    Akka: { icon: ['fab', 'java'], color: '#007396' }, // Popular Scala lib
    Intellij: { icon: ['fab', 'java'], color: '#007396' }, // Java IDE, common target
    Ktor: { icon: ['fab', 'java'], color: '#007396' }, // Kotlin lib
    Ahc: { icon: ['fab', 'java'], color: '#007396' }, // AsyncHttpClient, popular Java lib

    Android: { icon: ['fab', 'android'], color: '#78C257' },
    Okhttp: { icon: ['fab', 'android'], color: '#78C257' }, // Popular Android HTTP lib
    Fbandroidsdk: { icon: ['fab', 'android'], color: '#78C257' }, // FB Android SDK

    Iphone: { icon: ['fab', 'apple'], color: '#000' },
    iOS: { icon: ['fab', 'apple'], color: '#000' },
    Ios: { icon: ['fab', 'apple'], color: '#000' },
    Ipad: { icon: ['fab', 'apple'], color: '#000' },
    Darwin: { icon: ['fab', 'apple'], color: '#000' },

    Docker: { icon: ['fab', 'docker'], color: '#0db7ed' },
    Terminal: { icon: ['fas', 'terminal'], color: '#20c20e' },
    Network: { icon: ['fas', 'network-wired'], color: '#888' },
    Electron: { icon: ['fas', 'atom'], color: '#9FEAF9' },

    Desktop: { icon: ['fas', 'desktop'], color: '#888' },
    Unknown: { icon: ['fas', 'question'], color: '#888' }
} as const;

import { FontAwesomeIcon, Props as FAIProps } from '@fortawesome/react-fontawesome';
type ExtendedIconProp = IconProp | readonly ['fac', string] | readonly [IconPrefix, IconName];
export const Icon = React.memo(
    FontAwesomeIcon as (props: Omit<FAIProps, 'icon'> & {
        icon: ExtendedIconProp,
        onClick?: (event: React.MouseEvent) => void,
        onKeyPress?: (event: React.KeyboardEvent) => void
    }) => JSX.Element
);
export type { ExtendedIconProp as IconProp, SizeProp };

export const SuggestionIcon = styled(Icon).attrs(() => ({
    icon: ['fas', 'lightbulb']
}))`
    margin: 0 6px;
    color: #2fb4e0;
`;

export const suggestionIconHtml = iconHtml(
    { prefix: 'fas', iconName: 'lightbulb' },
    {
        styles: {
            margin: '0 6px',
            color: '#2fb4e0'
        }
    }
);

export const WarningIcon = styled(Icon).attrs(() => ({
    icon: ['fas', 'exclamation-triangle']
}))`
    margin: 0 6px;
    color: ${p => p.theme.warningColor};
`;

export const warningIconHtml = iconHtml(
    { prefix: 'fas', iconName: 'exclamation-triangle' },
    {
        styles: {
            margin: '0 6px',
            color: warningColor
        }
    }
);

export const ArrowIcon = styled(Icon).attrs(() => ({
    fixedWidth: true,
    icon: ['fas', 'arrow-left']
}))`
    ${(p: { direction: 'left' | 'right' }) =>
        p.direction === 'right'
        ? 'transform: rotate(180deg);'
        : ''
    }
    padding: 0 15px;
`;

function iconHtml(iconLookup: IconLookup, options?: IconParams): string {
    return icon(iconLookup, options).html.join('');
}