import styled, {
  injectGlobal,
  css,
  keyframes,
  ThemeProvider,
  ThemedStyledComponentsModule
} from 'styled-components';

import reset from 'styled-reset'

// Import required FA icons:
import fontawesome from '@fortawesome/fontawesome'
import { faSpinnerThird, faArrowLeft } from '@fortawesome/fontawesome-pro-regular';
fontawesome.library.add(faArrowLeft, faSpinnerThird);

export { styled, css, injectGlobal, keyframes, ThemeProvider };

export const theme = {
    mainBackground: '#ffffff',
    
    containerBackground: '#d8e2e6',
    containerWatermark: '#b6c2ca',
    containerBorder: '#abb4ba'
};

export type Theme = typeof theme;

export function injectGlobalStyles() {
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

        body {
            font-family: Lato;
            background-color: ${theme.containerBackground};
        }
    `;
}