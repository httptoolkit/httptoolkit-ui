import * as styledComponents from 'styled-components';
import * as polished from 'polished';
import type { ThemeProps } from 'styled-components';
import type * as monacoTypes from 'monaco-editor';

import "@fontsource/dm-sans";
import "@fontsource/dm-mono";
import "@fontsource/saira";

import reset from 'styled-reset';

const fontSizes = {
    smallPrintSize: '12px',
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
const warningBackground = '#f1971f40';
export const popColor = '#e1421f';

const black = "#000000";
const inkBlack = "#16181e";
const inkGrey = "#1e2028";
const darkerGrey = "#25262e";
const darkGrey = "#32343B";
const darkishGrey =  "#53565e";
const mediumGrey = "#818490";
const lightGrey = "#9a9da8";
const ghostGrey = "#e4e8ed";
const greyWhite = "#f2f2f2";
const almostWhite = "#fafafa";
const white = "#ffffff";

const darkerBlue = "#2d4cbd";
const lighterBlue = "#6284fa";

const globalMonacoOverrides = {
    'editorWarning.foreground': '#ff0000'
};

export const lightTheme = {
    fontFamily: '"DM Sans", Arial, sans-serif',
    titleTextFamily: 'Saira, "DM Sans", Arial, sans-serif',
    monoFontFamily: '"DM Mono", monospace',

    mainBackground: almostWhite,
    mainLowlightBackground: greyWhite,
    mainColor: inkGrey,
    mainLowlightColor: darkishGrey,

    highlightBackground: white,
    highlightColor: inkGrey,

    lowlightTextOpacity: 0.65,
    boxShadowAlpha: 0.3,

    pillContrast: 0.9,
    pillDefaultColor: lightGrey,

    primaryInputBackground: darkerBlue,
    primaryInputColor: white,

    secondaryInputBorder: lighterBlue,
    secondaryInputColor: darkerBlue,

    inputBackground: white,
    inputHoverBackground: greyWhite,
    inputBorder: darkishGrey,
    inputColor: inkGrey,
    inputPlaceholderColor: darkishGrey,
    inputWarningPlaceholder: '#8c5c1d', // Mix of warning + inkGrey

    popColor,
    popOverlayColor: white,

    warningColor,
    warningBackground,

    containerBackground: ghostGrey,
    containerWatermark: mediumGrey,
    containerBorder: lightGrey,

    // These are the same as the standard defaults
    linkColor: '#0000EE',
    visitedLinkColor: '#551A8B',

    monacoTheme: 'vs-custom',
    monacoThemeBase: 'vs',
    monacoThemeOverrides: globalMonacoOverrides,

    modalGradient: 'radial-gradient(#40404b, #111118)',
    modalColor: almostWhite,

    ...fontSizes,

    globalCss: ''
} as const;

export const darkTheme = {
    fontFamily: '"DM Sans", Arial, sans-serif',
    titleTextFamily: 'Saira, "DM Sans", Arial, sans-serif',
    monoFontFamily: '"DM Mono", monospace',

    mainBackground: darkGrey,
    mainLowlightBackground: darkerGrey,
    mainColor: white,
    mainLowlightColor: mediumGrey,

    highlightBackground: darkishGrey,
    highlightColor: white,

    lowlightTextOpacity: 0.65,
    boxShadowAlpha: 0.4,

    pillContrast: 0.85,
    pillDefaultColor: lightGrey,

    primaryInputBackground: darkerBlue,
    primaryInputColor: white,

    secondaryInputBorder: darkerBlue,
    secondaryInputColor: lighterBlue,

    inputBackground: inkBlack,
    inputHoverBackground: inkGrey,
    inputBorder: darkishGrey,
    inputColor: white,
    inputPlaceholderColor: mediumGrey,
    inputWarningPlaceholder: '#e8b978', // Mix of warning + white

    popColor,
    popOverlayColor: white,

    warningColor,
    warningBackground,
    containerBackground: inkGrey,
    containerWatermark: lightGrey,
    containerBorder: black,

    linkColor: '#8699ff',
    visitedLinkColor: '#ac7ada',

    monacoTheme: 'vs-dark-custom',
    monacoThemeBase: 'vs-dark',
    monacoThemeOverrides: {
        ...globalMonacoOverrides,
        'editor.background': inkBlack // Same as input background - darker for more contrast vs containerBg
    },

    modalGradient: `radial-gradient(${white}, ${lightGrey})`,
    modalColor: darkGrey,

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
} as const;

export const highContrastTheme = {
    fontFamily: '"DM Sans", Arial, sans-serif',
    titleTextFamily: 'Saira, "DM Sans", Arial, sans-serif',
    monoFontFamily: '"DM Mono", monospace',

    mainBackground: '#000000',
    mainLowlightBackground: '#262626',
    mainColor: '#ffffff',
    mainLowlightColor: '#ffffff',

    highlightBackground: '#ffffff',
    highlightColor: '#000',

    lowlightTextOpacity: 0.8,
    boxShadowAlpha: 0.1,

    pillContrast: 0.95,
    pillDefaultColor: mediumGrey,

    primaryInputBackground: darkerBlue,
    primaryInputColor: '#ffffff',

    secondaryInputBorder: '#ffffff',
    secondaryInputColor: '#ffffff',

    inputBackground: '#ffffff',
    inputHoverBackground: '#ddd',
    inputBorder: '#aaa',
    inputColor: '#000000',
    inputPlaceholderColor: '#444',
    inputWarningPlaceholder: '#e1b374', // Mix of warning + white

    popColor,
    popOverlayColor: '#ffffff',

    warningColor,
    warningBackground,

    containerBackground: darkGrey,
    containerWatermark: '#a0a0b0',
    containerBorder: '#000000',

    linkColor: '#8699ff',
    visitedLinkColor: '#ac7ada',

    monacoTheme: 'hc-black-custom',
    monacoThemeBase: 'hc-black',
    monacoThemeOverrides: globalMonacoOverrides,

    modalGradient: '#f0f0f0',
    modalColor: black,

    ...fontSizes,

    globalCss: ``
} as const;

export const Themes = {
    'light': lightTheme,
    'dark': darkTheme,
    'high-contrast': highContrastTheme
};

export type ThemeName = keyof typeof Themes;
export type Theme = typeof Themes[ThemeName];

export function defineMonacoThemes(monaco: typeof monacoTypes) {
    Object.values(Themes).forEach((theme) => {
        monaco.editor.defineTheme(theme.monacoTheme, {
            base: theme.monacoThemeBase,
            inherit: true,
            rules: [],
            colors: theme.monacoThemeOverrides
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

    * {
        box-sizing: border-box;
    }

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

    /* Override some Monaco CSS internals */
    .monaco-editor {
        /* Our editors don't have real filenames, so hide that from error popups: */
        .zone-widget .filename {
            display: none;
        }
    }

    .phosphor-icon {
        /* Ensures icons line up with FontAwesome & neighbouring text */
        vertical-align: -0.125em;
    }

    ${p => p.theme.globalCss}
`;