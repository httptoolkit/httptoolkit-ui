import * as styledComponents from 'styled-components';
import * as polished from 'polished';
import { ThemeProps } from 'styled-components';

import reset from 'styled-reset'

const fontSizes = {
    textSize: '16px',
    headingSize: '22px',
    loudHeadingSize: '40px',
}

export const lightTheme = {
    fontFamily: 'Lato, Arial, sans-serif',
    monoFontFamily: "'Fira Mono', monospace",

    mainBackground: '#fafafa',
    mainLowlightBackground: '#eaeaea',
    mainColor: '#222',

    primaryInputColor: '#1f83e0',

    pillContrast: 0.8,

    popBackground: '#ffffff',
    popColor: '#e1421f',

    containerBackground: '#d8e2e6',
    containerWatermark: '#a0afaf',
    containerBorder: '#888',

    monacoTheme: 'vs',

    ...fontSizes,

    globalCss: ''
};

export const darkTheme = {
    fontFamily: 'Lato, Arial, sans-serif',
    monoFontFamily: "'Fira Mono', monospace",

    mainBackground: '#222222',
    mainLowlightBackground: '#3f3f3f',
    mainColor: '#efefef',

    primaryInputColor: '#1f83e0',

    pillContrast: 0.8,

    popBackground: '#111111',
    popColor: '#e1421f',

    containerBackground: '#3c3c41',
    containerWatermark: '#757580',
    containerBorder: '#000000',

    monacoTheme: 'vs-dark',

    ...fontSizes,

    /* In dark theme, we need to override the scrollbars or they stick out like a sore thumb */
    globalCss: styledComponents.css`
        ::-webkit-scrollbar {
            background-color: ${p => polished.darken(0.2, p.theme.containerBackground)};
        }

        ::-webkit-scrollbar-thumb {
            background-color: ${p => polished.lighten(0.2, p.theme.containerBackground)};
        }

        /* Standard, but poorly supported: */
        scrollbar-color: dark;
    `
};

export type Theme = typeof lightTheme | typeof darkTheme;

const {
    default: styled,
    css,
    createGlobalStyle,
    keyframes,
    ThemeProvider,
} = styledComponents as unknown as styledComponents.ThemedStyledComponentsModule<Theme>;

export {
    styled,
    css,
    createGlobalStyle,
    keyframes,
    ThemeProvider,
    ThemeProps
};

export const GlobalStyles = createGlobalStyle`
    ${reset};

    body {
        font-family: ${p => p.theme.fontFamily};
        color: ${p => p.theme.mainColor};
        background-color: ${p => p.theme.containerBackground};
    }

    input {
        font-family: ${p => p.theme.fontFamily};
    }

    em {
        font-style: italic;
    }

    strong {
        font-weight: bold;
    }

    :active {
        outline: none;
    }

    .slow-spin {
        animation: fa-spin 5s infinite linear;
    }

    /* Override Auth0's style choices to match the rest of the UI */
    .auth0-lock {
        font-family: ${p => p.theme.fontFamily} !important;

        .auth0-lock-overlay {
            display: none; /* We have our own overlay we'll use instead */
        }

        .auth0-lock-widget {
            box-shadow: 0 2px 10px 0 rgba(0,0,0,0.2) !important;
            overflow: visible !important;
        }

        .auth0-lock-form {
            .auth0-lock-name {
                font-size: ${fontSizes.headingSize} !important;
            }

            p, .auth0-lock-social-button-text {
                font-size: ${fontSizes.textSize} !important;
            }
        }
    }

    ${p => p.theme.globalCss}
`;