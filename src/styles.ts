import * as styledComponents from 'styled-components';
import { ThemeProps } from 'styled-components';

import reset from 'styled-reset'

const fontSizes = {
    textSize: '16px',
    headingSize: '22px',
    loudHeadingSize: '40px',
}

export const lightTheme = {
    fontFamily: 'Lato, Arial, sans-serif',

    mainBackground: '#fafafa',
    mainLowlightBackground: '#eaeaea',
    mainColor: '#222',

    primaryInputColor: '#1f83e0',

    popBackground: '#ffffff',
    popColor: '#e1421f',

    containerBackground: '#d8e2e6',
    containerWatermark: '#a0afaf',
    containerBorder: '#888',

    monacoTheme: 'vs',

    ...fontSizes
};

export const darkTheme = {
    fontFamily: 'Lato, Arial, sans-serif',

    mainBackground: '#222222',
    mainLowlightBackground: '#333333',
    mainColor: '#efefef',

    primaryInputColor: '#1f83e0',

    popBackground: '#111111',
    popColor: '#e1421f',

    containerBackground: '#2c2c31',
    containerWatermark: '#757580',
    containerBorder: '#000000',

    monacoTheme: 'vs-dark',

    ...fontSizes
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
`;