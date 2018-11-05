import styled, {
  injectGlobal,
  css,
  keyframes,
  ThemeProvider
} from 'styled-components';

import reset from 'styled-reset'

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

import { faChrome } from '@fortawesome/free-brands-svg-icons/faChrome';
import { faFirefox } from '@fortawesome/free-brands-svg-icons/faFirefox';
import { faDocker } from '@fortawesome/free-brands-svg-icons/faDocker';

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
    faChrome,
    faFirefox,
    faDocker,
);

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export interface IconProps {
    icon: string[];
    color: string;
}

export const Icons = {
    Chrome: { icon: ['fab', 'chrome'], color: '#1da462' },
    Firefox: { icon: ['fab', 'firefox'], color: '#e66000' },
    Docker:  { icon: ['fab', 'docker'], color: '#0db7ed' },
    Network: { icon: ['fas', 'network-wired'], color: '#888' },
    Desktop: { icon: ['fas', 'desktop'], color: '#888' },
    Unknown: { icon: ['fas', 'question'], color: '#888' }
};

export { styled, css, injectGlobal, keyframes, ThemeProvider, FontAwesomeIcon };

const fontSizes = {
    textSize: '16px',
    headingSize: '22px',
    loudHeadingSize: '40px',
}

export const lightTheme = {
    mainBackground: '#fafafa',
    mainColor: '#222',

    popBackground: '#ffffff',
    popColor: '#e1421f',

    containerBackground: '#d8e2e6',
    containerWatermark: '#a0afaf',
    containerBorder: '#888',

    ...fontSizes
};

export const darkTheme = {
    mainBackground: '#222222',
    mainColor: '#efefef',

    popBackground: '#000',
    popColor: '#e1421f',

    containerBackground: '#303040',
    containerWatermark: '#606070',
    containerBorder: '#201010',

    ...fontSizes
};

export type Theme = typeof lightTheme;

export function injectGlobalStyles(theme: Theme) {
    injectGlobal`
        ${reset};

        /* latin-ext */
        @font-face {
            font-family: 'Lato';
            font-style: normal;
            font-weight: 400;
            src: local('Lato Regular'), local('Lato-Regular'), url(${require('./fonts/lato-ext.woff2')}) format('woff2');
            unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF;
        }

        /* latin */
        @font-face {
            font-family: 'Lato';
            font-style: normal;
            font-weight: 400;
            src: local('Lato Regular'), local('Lato-Regular'), url(${require('./fonts/lato.woff2')}) format('woff2');
            unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
        }

        /* latin-ext */
        @font-face {
            font-family: 'Fira Mono';
            font-style: normal;
            font-weight: 400;
            src: local('Fira Mono Regular'), local('FiraMono-Regular'), url(${require('./fonts/fira-mono-ext.woff2')}) format('woff2');
            unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF;
        }

        /* latin */
        @font-face {
            font-family: 'Fira Mono';
            font-style: normal;
            font-weight: 400;
            src: local('Fira Mono Regular'), local('FiraMono-Regular'), url(${require('./fonts/fira-mono.woff2')}) format('woff2');
            unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
        }

        body {
            font-family: Lato;
            color: ${theme.mainColor};
            background-color: ${theme.containerBackground};
        }

        input {
            font-family: Lato;
        }

        :active {
            outline: none;
        }

        .slow-spin {
            animation: fa-spin 6s infinite linear;
        }
    `;
}