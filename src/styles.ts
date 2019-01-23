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

export const GlobalStyles = createGlobalStyle`
    ${reset};

    body {
        font-family: Lato, Arial, sans-serif;
        color: ${p => p.theme.mainColor};
        background-color: ${p => p.theme.containerBackground};
    }

    input {
        font-family: Lato, sans-serif;
    }

    :active {
        outline: none;
    }

    .slow-spin {
        animation: fa-spin 5s infinite linear;
    }
`;