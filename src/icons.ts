import * as React from 'react';
import { styled } from './styles';

// Import required FA icons:
import {
    library,
    IconPrefix,
    IconDefinition,
    IconName,
    IconLookup,
    icon,
    IconParams
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
import { faLightbulb } from '@fortawesome/free-solid-svg-icons/faLightbulb';
import { faCog } from '@fortawesome/free-solid-svg-icons/faCog';
import { faStar } from '@fortawesome/free-regular-svg-icons/faStar';
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

import { faChrome } from '@fortawesome/free-brands-svg-icons/faChrome';
import { faFirefox } from '@fortawesome/free-brands-svg-icons/faFirefox';
import { faDocker } from '@fortawesome/free-brands-svg-icons/faDocker';
import { faAndroid } from '@fortawesome/free-brands-svg-icons/faAndroid';
import { faApple } from '@fortawesome/free-brands-svg-icons/faApple';
import { faSafari } from '@fortawesome/free-brands-svg-icons/faSafari';
import { faEdge } from '@fortawesome/free-brands-svg-icons/faEdge';
import { faInternetExplorer } from '@fortawesome/free-brands-svg-icons/faInternetExplorer';
import { faCodeBranch } from '@fortawesome/free-solid-svg-icons/faCodeBranch';
import { faNpm } from '@fortawesome/free-brands-svg-icons/faNpm';
import { faNodeJs } from '@fortawesome/free-brands-svg-icons/faNodeJs';
import { faPhp } from '@fortawesome/free-brands-svg-icons/faPhp';
import { faPython } from '@fortawesome/free-brands-svg-icons/faPython';

const customSpinnerArc: IconDefinition = {
    // Based on https://codepen.io/aurer/pen/jEGbA
    prefix: <IconPrefix>'fac',
    iconName: <IconName>'spinner-arc',
    icon: [
        // height x width
        50, 50,
        [],
        '',
        // SVG path
        'M25.251,6.461c-10.318,0-18.683,8.365-18.683,18.683h4.068c0-8.071,6.543-14.615,14.615-14.615V6.461z'
    ]
};

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
    faLightbulb,
    faCog,
    faStar,
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

    faChrome,
    faFirefox,
    faDocker,
    faAndroid,
    faApple,
    faSafari,
    faEdge,
    faInternetExplorer,
    faCodeBranch,
    faNpm,
    faNodeJs,
    faPhp,
    faPython
);

export interface IconProps {
    icon: string[];
    color: string;
}

export const Icons = {
    Chrome: { icon: ['fab', 'chrome'], color: '#1da462' },
    Chromium: { icon: ['fab', 'chrome'], color: '#4489f4' },
    Firefox: { icon: ['fab', 'firefox'], color: '#e66000' },
    Safari: { icon: ['fab', 'safari'], color: '#448aff' },
    Edge: { icon: ['fab', 'edge'], color: '#2c75be' },
    IE: { icon: ['fab', 'internet-explorer'], color: '#00baf0' },
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

    Docker: { icon: ['fab', 'docker'], color: '#0db7ed' },
    Terminal: { icon: ['fas', 'terminal'], color: '#20c20e' },
    Network: { icon: ['fas', 'network-wired'], color: '#888' },
    Android: { icon: ['fab', 'android'], color: '#A4C639' },
    iOS: { icon: ['fab', 'apple'], color: '#000' },

    Desktop: { icon: ['fas', 'desktop'], color: '#888' },
    Unknown: { icon: ['fas', 'question'], color: '#888' }
};

import { FontAwesomeIcon as FAI } from '@fortawesome/react-fontawesome';
export const FontAwesomeIcon = React.memo(FAI);

export const SuggestionIcon = styled(FontAwesomeIcon).attrs({
    icon: ['fas', 'lightbulb']
})`
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

export const WarningIcon = styled(FontAwesomeIcon).attrs({
    icon: ['fas', 'exclamation-triangle']
})`
    margin: 0 6px;
    color: #f1971f;
`;

export const warningIconHtml = iconHtml(
    { prefix: 'fas', iconName: 'exclamation-triangle' },
    {
        styles: {
            margin: '0 6px',
            color: '#f1971f'
        }
    }
);

function iconHtml(iconLookup: IconLookup, options?: IconParams): string {
    return icon(iconLookup, options).html.join('');
}