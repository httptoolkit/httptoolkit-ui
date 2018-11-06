import * as styledComponents from 'styled-components';
import { ThemeProps } from 'styled-components';

import reset from 'styled-reset'

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

export type Theme = typeof lightTheme | typeof darkTheme;

const {
    default: styled,
    css,
    createGlobalStyle,
    keyframes,
    ThemeProvider,
} = styledComponents as styledComponents.ThemedStyledComponentsModule<Theme>;

export {
    styled,
    css,
    createGlobalStyle,
    keyframes,
    ThemeProvider,
    ThemeProps
};

export function createGlobalStyles(theme: Theme) {
    return createGlobalStyle`
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
            color: ${p => p.theme.mainColor};
            background-color: ${p => p.theme.containerBackground};
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