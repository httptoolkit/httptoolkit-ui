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

library.add(
    faArrowLeft,
    faSpinnerThird,
    faSpinner,
    faTrashAlt,
    faSearch,
    faPlug
);

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export { styled, css, injectGlobal, keyframes, ThemeProvider, FontAwesomeIcon };

const fontSizes = {
    textSize: '16px',
    headingSize: '22px'
}

export const lightTheme = {
    mainBackground: '#fafafa',
    mainColor: '#222',

    headingBackground: '#e1421f',
    headingBorder: '#712c1c',
    headingColor: '#ffffff',

    popBackground: '#ffffff',
    popBorder: '#e26f29',
    popColor: '#e1421f',

    containerBackground: '#d8e2e6',
    containerWatermark: '#b6c2ca',
    containerBorder: '#abb4ba',

    ...fontSizes
};

export const darkTheme = {
    mainBackground: '#222222',
    mainColor: '#efefef',

    headingBackground: '#e1421f',
    headingBorder: '#712c1c',
    headingColor: '#fafafa',

    popBackground: '#000',
    popBorder: '#e26f29',
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

        :active {
            outline: none;
        }
    `;
}