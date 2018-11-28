// Import required FA icons:
import { library } from '@fortawesome/fontawesome-svg-core';

import { faSpinner } from '@fortawesome/pro-light-svg-icons/faSpinner';
import { faSpinnerThird } from '@fortawesome/pro-regular-svg-icons/faSpinnerThird';
import { faTrashAlt } from '@fortawesome/pro-regular-svg-icons/faTrashAlt';
import { faArrowLeft } from '@fortawesome/pro-regular-svg-icons/faArrowLeft';
import { faSearch } from '@fortawesome/free-solid-svg-icons/faSearch';
import { faPlug } from '@fortawesome/free-solid-svg-icons/faPlug';
import { faNetworkWired } from '@fortawesome/free-solid-svg-icons/faNetworkWired';
import { faDesktop } from '@fortawesome/free-solid-svg-icons/faDesktop';
import { faQuestion } from '@fortawesome/free-solid-svg-icons/faQuestion';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import { faChevronUp } from '@fortawesome/free-solid-svg-icons/faChevronUp';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faBan } from '@fortawesome/pro-regular-svg-icons/faBan';
import { faComment } from '@fortawesome/free-regular-svg-icons/faComment';

import { faChrome } from '@fortawesome/free-brands-svg-icons/faChrome';
import { faFirefox } from '@fortawesome/free-brands-svg-icons/faFirefox';
import { faDocker } from '@fortawesome/free-brands-svg-icons/faDocker';
import { faAndroid } from '@fortawesome/free-brands-svg-icons/faAndroid';
import { faApple } from '@fortawesome/free-brands-svg-icons/faApple';
import { faSafari } from '@fortawesome/free-brands-svg-icons/faSafari';
import { faEdge } from '@fortawesome/free-brands-svg-icons/faEdge';
import { faInternetExplorer } from '@fortawesome/free-brands-svg-icons/faInternetExplorer';

library.add(
    faArrowLeft,
    faSpinnerThird,
    faSpinner,
    faTrashAlt,
    faSearch,
    faPlug,
    faNetworkWired,
    faDesktop,
    faQuestion,
    faTimes,
    faChevronUp,
    faChevronDown,
    faBan,
    faComment,

    faChrome,
    faFirefox,
    faDocker,
    faAndroid,
    faApple,
    faSafari,
    faEdge,
    faInternetExplorer
);

export { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export interface IconProps {
    icon: string[];
    color: string;
}

export const Icons = {
    Chrome: { icon: ['fab', 'chrome'], color: '#1da462' },
    Firefox: { icon: ['fab', 'firefox'], color: '#e66000' },
    Safari: { icon: ['fab', 'safari'], color: '#448aff' },
    Edge: { icon: ['fab', 'edge'], color: '#2c75be' },
    InternetExplorer: { icon: ['fab', 'internet-explorer'], color: '#00baf0' },
    Docker:  { icon: ['fab', 'docker'], color: '#0db7ed' },
    Network: { icon: ['fas', 'network-wired'], color: '#888' },
    Android: { icon: ['fab', 'android'], color: '#A4C639' },
    iOS: { icon: ['fab', 'apple'], color: '#000' },
    Desktop: { icon: ['fas', 'desktop'], color: '#888' },
    Unknown: { icon: ['fas', 'question'], color: '#888' }
};