import * as styledComponents from 'styled-components';
import * as polished from 'polished';
import type { ThemeProps } from 'styled-components';
import type * as monacoTypes from 'monaco-editor';

import "@fontsource/dm-sans";
import "@fontsource/dm-mono";
import "@fontsource/saira";

import reset from 'styled-reset';

const fontSizes = {
    textInputFontSize: '13px',
    textSize: '14.5px',
    subHeadingSize: '17px',
    headingSize: '20px',
    largeHeadingSize: '24px',
    loudHeadingSize: '38px',
    screamingHeadingSize: '80px'
};
import "react-contexify/dist/ReactContexify.css";

export const NARROW_LAYOUT_BREAKPOINT = 1100;

export const warningColor = '#f1971f';
export const popColor = '#e1421f';

export const lightTheme = {
    fontFamily: '"DM Sans", Arial, sans-serif',
    titleTextFamily: 'Saira, "DM Sans", Arial, sans-serif',
    monoFontFamily: '"DM Mono", monospace',

    mainBackground: '#fafafa',
    mainLowlightBackground: '#eaeaea',
    mainColor: '#222',

    lowlightTextOpacity: 0.65,
    pillContrast: 0.8,
    boxShadowAlpha: 0.2,

    primaryInputBackground: '#1076b9',
    primaryInputColor: '#fafafa',

    secondaryInputBorder: '#7ab2e2',
    secondaryInputColor: '#1665af',

    inputBackground: '#fafafa',
    inputHoverBackground: '#eee',
    inputBorder: '#a0afaf',
    inputColor: '#222222',

    highlightBackground: '#ffffff',
    highlightColor: '#222',

    popColor,

    warningColor,
    warningBackground: '#f1971f40',

    containerBackground: '#d8e2e6',
    containerWatermark: '#a0afaf',
    containerBorder: '#888',

    // These are the same as the standard defaults
    linkColor: '#0000EE',
    visitedLinkColor: '#551A8B',

    monacoTheme: 'vs-custom',

    modalGradient: 'radial-gradient(#40404b, #111118)',

    ...fontSizes,

    globalCss: ''
};

export const darkTheme = {
    fontFamily: '"DM Sans", Arial, sans-serif',
    titleTextFamily: 'Saira, "DM Sans", Arial, sans-serif',
    monoFontFamily: '"DM Mono", monospace',

    mainBackground: '#222222',
    mainLowlightBackground: '#303030',
    mainColor: '#efefef',

    lowlightTextOpacity: 0.6,
    pillContrast: 0.8,
    boxShadowAlpha: 0.4,

    primaryInputBackground: '#0868c1',
    primaryInputColor: '#fafafa',

    secondaryInputBorder: '#1b5b96',
    secondaryInputColor: '#6babe6',

    inputBackground: '#1a1a1a',
    inputHoverBackground: '#333',
    inputBorder: '#666',
    inputColor: '#fafafa',

    highlightBackground: '#111111',
    highlightColor: '#efefef',

    popColor,

    warningColor,
    warningBackground: '#f1971f40',

    containerBackground: '#3c3c41',
    containerWatermark: '#757580',
    containerBorder: '#000000',

    linkColor: '#8699ff',
    visitedLinkColor: '#ac7ada',

    monacoTheme: 'vs-dark-custom',

    modalGradient: 'radial-gradient(#ffffff,#9c9c9c)',

    ...fontSizes,

    /* In dark theme, we need to override the scrollbars or they stick out like a sore thumb */
    globalCss: styledComponents.css`
        @supports (color-scheme: dark) {
            :root {
                color-scheme: dark;
            }
        }

        @supports not (color-scheme: dark) {
            ::-webkit-scrollbar {
                background-color: ${p => polished.darken(0.2, p.theme.containerBackground)};
            }

            ::-webkit-scrollbar-thumb {
                background-color: ${p => polished.lighten(0.2, p.theme.containerBackground)};
            }

            /* Standard, but poorly supported: */
            scrollbar-color: dark;
        }
    `
};

export const highContrastTheme = {
    fontFamily: '"DM Sans", Arial, sans-serif',
    titleTextFamily: 'Saira, "DM Sans", Arial, sans-serif',
    monoFontFamily: '"DM Mono", monospace',

    mainBackground: '#000000',
    mainLowlightBackground: '#262626',
    mainColor: '#ffffff',

    lowlightTextOpacity: 0.8,
    pillContrast: 0.95,
    boxShadowAlpha: 0.1,

    primaryInputBackground: '#0868c1',
    primaryInputColor: '#ffffff',

    secondaryInputBorder: '#ffffff',
    secondaryInputColor: '#ffffff',

    inputBackground: '#ffffff',
    inputHoverBackground: '#ddd',
    inputBorder: '#aaa',
    inputColor: '#000000',

    highlightBackground: '#ffffff',
    highlightColor: '#000',

    popColor,

    warningColor,
    warningBackground: '#f1971f40',

    containerBackground: '#404045',
    containerWatermark: '#a0a0b0',
    containerBorder: '#000000',

    linkColor: '#8699ff',
    visitedLinkColor: '#ac7ada',

    monacoTheme: 'hc-black-custom',

    modalGradient: '#c0c0c0',

    ...fontSizes,

    globalCss: ``
};

export const Themes = {
    'light': lightTheme,
    'dark': darkTheme,
    'high-contrast': highContrastTheme
};

export type ThemeName = keyof typeof Themes;
export type Theme = typeof Themes[ThemeName];

const monacoColorOverrides = {
    'editorWarning.foreground': '#ff0000',
};

const monacoThemes = ['vs', 'vs-dark', 'hc-black'] as const;

export function defineMonacoThemes(monaco: typeof monacoTypes) {
    monacoThemes.forEach((themeName) => {
        monaco.editor.defineTheme(`${themeName}-custom`, {
            base: themeName,
            inherit: true,
            rules: [],
            colors: monacoColorOverrides
        });
    });
}

const {
    default: styled,
    css,
    createGlobalStyle,
    keyframes,
    ThemeProvider,
    StyleSheetManager
} = styledComponents as unknown as styledComponents.ThemedStyledComponentsModule<Theme>;

export {
    styled,
    css,
    createGlobalStyle,
    keyframes,
    ThemeProvider,
    type ThemeProps,
    StyleSheetManager
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
            box-shadow: 0 2px 10px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha}) !important;
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

    /* Override some Monaco CSS internals */
    .monaco-editor {
        /* Our editors don't have real filenames, so hide that from error popups: */
        .zone-widget .filename {
            display: none;
        }
    }

    ${p => p.theme.globalCss}
`;